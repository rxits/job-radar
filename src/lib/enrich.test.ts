import { describe, it, expect } from "vitest";
import { createDb } from "./db";
import { domainCandidates, emailPatterns, enrichContact } from "./enrich";
import type { GeminiClient, NormalizedJob } from "./types";

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "test", dedupeKey: "k1", company: "Acme Inc", title: "Engineer",
    location: "Remote", remote: true, salary: null, url: "https://jobs.lever.co/acme/123",
    description: "Join Acme. Contact our founder.", postedAt: null, geoRaw: null, ...over,
  };
}

describe("domainCandidates", () => {
  it("derives slug-based domains from the company name", () => {
    const c = domainCandidates("Acme Inc", "https://jobs.lever.co/acme/123");
    expect(c).toContain("acme.com");
    expect(c).toContain("acme.io");
  });
  it("ignores known job-board hosts as the company domain", () => {
    const c = domainCandidates("Acme Inc", "https://jobs.lever.co/acme/123");
    expect(c).not.toContain("lever.co");
  });
  it("uses the job url host when it is the company's own site", () => {
    const c = domainCandidates("Acme Inc", "https://acme.com/careers/123");
    expect(c[0]).toBe("acme.com");
  });
});

describe("emailPatterns", () => {
  it("generates common patterns in priority order", () => {
    expect(emailPatterns("Jane Doe", "acme.com")).toEqual([
      "jane@acme.com",
      "jane.doe@acme.com",
      "janedoe@acme.com",
    ]);
  });
  it("handles single-word names", () => {
    expect(emailPatterns("Jane", "acme.com")).toEqual(["jane@acme.com"]);
  });
});

describe("enrichContact", () => {
  const mockClient: GeminiClient = {
    async generateJSON() {
      return JSON.stringify({
        personName: "Jane Doe",
        personTitle: "CTO & Co-founder",
        emails: ["jane@acme.com"],
        links: ["https://linkedin.com/in/janedoe"],
      });
    },
  };
  const fetchFn = async () => "<html><body>Jane Doe, CTO. jane@acme.com</body></html>";

  it("extracts a contact, marks it found, and persists it", async () => {
    const db = createDb(":memory:");
    db.upsertJobs([job()]);
    const jobId = db.listJobs({})[0].id;
    const c = await enrichContact(db, mockClient, jobId, fetchFn);
    expect(c.personName).toBe("Jane Doe");
    expect(c.personTitle).toContain("CTO");
    expect(c.emails).toContain("jane@acme.com");
    expect(c.confidence).toBe("found");
    // persisted
    const stored = db.getContact(jobId);
    expect(stored?.personName).toBe("Jane Doe");
  });

  it("falls back to guessed emails when none are found", async () => {
    const db = createDb(":memory:");
    db.upsertJobs([job()]);
    const jobId = db.listJobs({})[0].id;
    const guessClient: GeminiClient = {
      async generateJSON() {
        return JSON.stringify({ personName: "Jane Doe", personTitle: "CTO", emails: [], links: [] });
      },
    };
    const c = await enrichContact(db, guessClient, jobId, fetchFn);
    expect(c.confidence).toBe("guessed");
    expect(c.emails).toContain("jane@acme.com"); // generated pattern
  });
});
