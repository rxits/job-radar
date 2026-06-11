import { describe, it, expect } from "vitest";
import { generateKit } from "./tailor";
import { createDb } from "./db";
import type { GeminiClient, NormalizedJob } from "./types";

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "test", dedupeKey: "tj1", company: "Acme", title: "Senior Engineer",
    location: "Remote", remote: true, salary: null, url: "https://x/1",
    description: "We need a react and typescript expert.", postedAt: null, geoRaw: null, ...over,
  };
}

const stubKit = { resumeMd: "# Alice Smith\n\n## Summary\nExperienced.", coverMd: "Dear Hiring Manager,", outreachMd: "Subject: Interested\nHi," };

function makeStub(response: string): GeminiClient {
  return {
    async generateJSON() { return response; },
  };
}

describe("generateKit", () => {
  it("happy path: returns KitDraft, persists via getKit, hasKit flips true", async () => {
    const db = createDb(":memory:");
    db.saveProfile("Alice Smith\nSenior Engineer with 5 years React/TypeScript", "react, typescript");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;

    const stub = makeStub(JSON.stringify(stubKit));
    const result = await generateKit(db, stub, id);

    expect(result.resumeMd).toBe(stubKit.resumeMd);
    expect(result.coverMd).toBe(stubKit.coverMd);
    expect(result.outreachMd).toBe(stubKit.outreachMd);

    const saved = db.getKit(id)!;
    expect(saved).not.toBeNull();
    expect(saved.resumeMd).toBe(stubKit.resumeMd);
    expect(saved.model).toBe("gemini-2.5-pro");

    expect(db.getJob(id)!.hasKit).toBe(true);
  });

  it("throws 'no profile set' without profile — stub must not be called", async () => {
    const db = createDb(":memory:");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() { throw new Error("stub should not be called"); },
    };
    await expect(generateKit(db, stub, id)).rejects.toThrow("no profile set");
  });

  it("throws 'job not found' for bogus id", async () => {
    const db = createDb(":memory:");
    db.saveProfile("resume", "ts");
    const stub = makeStub(JSON.stringify(stubKit));
    await expect(generateKit(db, stub, "no-such-id")).rejects.toThrow("job not found");
  });

  it("throws on empty artifact when stub returns empty resumeMd", async () => {
    const db = createDb(":memory:");
    db.saveProfile("resume", "ts");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub = makeStub(JSON.stringify({ resumeMd: "", coverMd: "C", outreachMd: "O" }));
    await expect(generateKit(db, stub, id)).rejects.toThrow("empty resumeMd in kit result");
  });

  it("fence-wrapped JSON response still parses", async () => {
    const db = createDb(":memory:");
    db.saveProfile("Alice Smith\nReact dev", "react");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub = makeStub("```json\n" + JSON.stringify(stubKit) + "\n```");
    const result = await generateKit(db, stub, id);
    expect(result.resumeMd).toBe(stubKit.resumeMd);
  });
});
