import { describe, it, expect } from "vitest";
import { tailorResume } from "./tailor";
import { createDb } from "./db";
import type { GeminiClient, NormalizedJob } from "./types";

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "test", dedupeKey: "tj1", company: "Acme", title: "Senior Engineer",
    location: "Remote", remote: true, salary: null, url: "https://x/1",
    description: "We need a react and typescript expert.", postedAt: null, geoRaw: null, ...over,
  };
}

const stubMarkdown = "# Alice Smith\n\n## Summary\nExperienced engineer.\n";

function makeStub(response: string): GeminiClient {
  return {
    async generateJSON() { return response; },
  };
}

describe("tailorResume", () => {
  it("happy path: returns markdown, persists via getTailored, hasTailored flips true", async () => {
    const db = createDb(":memory:");
    db.saveProfile("Alice Smith\nSenior Engineer with 5 years React/TypeScript", "react, typescript");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;

    const stub = makeStub(JSON.stringify({ markdown: stubMarkdown }));
    const result = await tailorResume(db, stub, id);

    expect(result.markdown).toBe(stubMarkdown);

    const saved = db.getTailored(id);
    expect(saved).not.toBeNull();
    expect(saved!.markdown).toBe(stubMarkdown);
    expect(saved!.model).toBe("gemini-2.5-pro");

    const row = db.getJob(id);
    expect(row!.hasTailored).toBe(true);
  });

  it("throws 'no profile set' without profile — stub must not be called", async () => {
    const db = createDb(":memory:");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() { throw new Error("stub should not be called"); },
    };
    await expect(tailorResume(db, stub, id)).rejects.toThrow("no profile set");
  });

  it("throws 'job not found' for bogus id", async () => {
    const db = createDb(":memory:");
    db.saveProfile("resume", "ts");
    const stub = makeStub(JSON.stringify({ markdown: stubMarkdown }));
    await expect(tailorResume(db, stub, "no-such-id")).rejects.toThrow("job not found");
  });

  it("throws 'empty tailoring result' when stub returns {markdown: ''}", async () => {
    const db = createDb(":memory:");
    db.saveProfile("resume", "ts");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub = makeStub(JSON.stringify({ markdown: "" }));
    await expect(tailorResume(db, stub, id)).rejects.toThrow("empty tailoring result");
  });

  it("fence-wrapped response still parses", async () => {
    const db = createDb(":memory:");
    db.saveProfile("Alice Smith\nReact dev", "react");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub = makeStub("```json\n" + JSON.stringify({ markdown: stubMarkdown }) + "\n```");
    const result = await tailorResume(db, stub, id);
    expect(result.markdown).toBe(stubMarkdown);
  });
});
