import { describe, it, expect } from "vitest";
import { matchNew, deepMatch } from "./match";
import { createDb } from "./db";
import type { GeminiClient, NormalizedJob } from "./types";

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return { source: "t", dedupeKey: Math.random().toString(36), company: "Acme", title: "Eng",
    location: null, remote: true, salary: null, url: "https://x/" + Math.random(),
    description: "react typescript", postedAt: null, geoRaw: null, ...over };
}

describe("matchNew", () => {
  it("scores only unscored jobs and persists results", async () => {
    const db = createDb(":memory:");
    db.saveProfile("senior react dev", "react, typescript");
    db.upsertJobs([job(), job()]);
    const ids = db.listJobs({}).map(j => j.id);
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify(ids.map((id, i) => ({ id, score: 80 + i, reason: "fit" })));
      },
    };
    const res = await matchNew(db, stub);
    expect(res.scored).toBe(2);
    expect(res.failedBatches).toBe(0);
    expect(res.failedJobs).toBe(0);
    expect(db.unscoredJobs().length).toBe(0);
    expect(db.listJobs({})[0].score).toBeGreaterThanOrEqual(80);
  });

  it("no-ops without a profile", async () => {
    const db = createDb(":memory:");
    db.upsertJobs([job()]);
    const stub: GeminiClient = { async generateJSON() { throw new Error("should not call"); } };
    const res = await matchNew(db, stub);
    expect(res.scored).toBe(0);
    expect(res.failedBatches).toBe(0);
    expect(res.failedJobs).toBe(0);
  });

  it("strips markdown fences and clamps out-of-range scores", async () => {
    const db = createDb(":memory:");
    db.saveProfile("dev", "ts");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() {
        return "```json\n" + JSON.stringify([{ id, score: 250, reason: "x" }]) + "\n```";
      },
    };
    await matchNew(db, stub);
    expect(db.listJobs({})[0].score).toBe(100);
  });

  it("a failing batch leaves jobs unscored without throwing", async () => {
    const db = createDb(":memory:");
    db.saveProfile("dev", "ts");
    db.upsertJobs([job()]);
    const stub: GeminiClient = { async generateJSON() { throw new Error("quota"); } };
    const res = await matchNew(db, stub, { retries: 2, backoffMs: 0 });
    expect(res.scored).toBe(0);
    expect(res.failedBatches).toBe(1);
    expect(res.failedJobs).toBe(1);
    expect(db.unscoredJobs().length).toBe(1);
  });

  it("ignores hallucinated ids not in the current batch", async () => {
    const db = createDb(":memory:");
    db.saveProfile("dev", "ts");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify([
          { id, score: 85, reason: "valid" },
          { id: "bogus-hallucinated-id", score: 90, reason: "hallucinated" },
        ]);
      },
    };
    const res = await matchNew(db, stub);
    expect(res.scored).toBe(1);
    expect(res.failedBatches).toBe(0);
    expect(res.failedJobs).toBe(0);
  });

  it("retries twice then succeeds on third attempt", async () => {
    const db = createDb(":memory:");
    db.saveProfile("dev", "ts");
    db.upsertJobs([job(), job()]);
    const ids = db.listJobs({}).map((j) => j.id);
    let attempts = 0;
    const stub: GeminiClient = {
      async generateJSON() {
        attempts++;
        if (attempts < 3) throw new Error("transient error");
        return JSON.stringify(ids.map((id, i) => ({ id, score: 70 + i, reason: "ok" })));
      },
    };
    const res = await matchNew(db, stub, { retries: 2, backoffMs: 0 });
    expect(res.scored).toBe(2);
    expect(res.failedBatches).toBe(0);
    expect(res.failedJobs).toBe(0);
    expect(attempts).toBe(3);
  });

  it("always-failing client reports failedBatches and failedJobs", async () => {
    const db = createDb(":memory:");
    db.saveProfile("dev", "ts");
    db.upsertJobs([job(), job(), job()]);
    const stub: GeminiClient = { async generateJSON() { throw new Error("always fails"); } };
    const res = await matchNew(db, stub, { retries: 2, backoffMs: 0 });
    expect(res.scored).toBe(0);
    expect(res.failedBatches).toBe(1);
    expect(res.failedJobs).toBe(3);
    expect(db.unscoredJobs().length).toBe(3);
  });
});

describe("deepMatch", () => {
  it("returns structured gap analysis for one job", async () => {
    const db = createDb(":memory:");
    db.saveProfile("react dev", "react");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify({ score: 72, summary: "decent", gaps: ["k8s"], tailoring: ["lead with react"] });
      },
    };
    const dm = await deepMatch(db, stub, id);
    expect(dm.score).toBe(72);
    expect(dm.gaps).toContain("k8s");
  });

  it("preserves the flash-pass aiFriendly score", async () => {
    const db = createDb(":memory:");
    db.saveProfile("react dev", "react");
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.saveMatch(id, 60, "ok", "gemini-2.5-flash", 75);
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify({ score: 80, summary: "good", gaps: [], tailoring: [] });
      },
    };
    await deepMatch(db, stub, id);
    expect(db.listJobs({})[0].aiFriendly).toBe(75);
  });
});

describe("matchNew v2 (eligibility + aiFriendly)", () => {
  it("persists aiFriendly and sets eligibility from stub output", async () => {
    const db = createDb(":memory:");
    db.saveProfile("react dev", "react", "Chandigarh, India", "IST", null);
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify([{ id, score: 80, reason: "good fit", eligible: "yes", eligibilityReason: "open worldwide", aiFriendly: 75 }]);
      },
    };
    await matchNew(db, stub);
    const row = db.listJobs({})[0];
    expect(row.aiFriendly).toBe(75);
    expect(row.eligibility).toBe("eligible");
    expect(row.eligibilityReason).toBeTruthy();
  });

  it("does not overwrite a pre-set ineligible verdict even when eligible:yes returned", async () => {
    const db = createDb(":memory:");
    db.saveProfile("react dev", "react", "Chandigarh, India", "IST", null);
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.setEligibility(id, "ineligible", "US only");
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify([{ id, score: 80, reason: "good fit", eligible: "yes", eligibilityReason: "open worldwide", aiFriendly: 60 }]);
      },
    };
    await matchNew(db, stub);
    const row = db.listJobs({})[0];
    expect(row.eligibility).toBe("ineligible");
    expect(row.eligibilityReason).toBe("US only");
  });

  it("stores null aiFriendly when value is missing or garbage, no crash", async () => {
    const db = createDb(":memory:");
    db.saveProfile("react dev", "react", "Chandigarh, India", "IST", null);
    db.upsertJobs([job(), job()]);
    const ids = db.listJobs({}).map(j => j.id);
    const stub: GeminiClient = {
      async generateJSON() {
        return JSON.stringify([
          { id: ids[0], score: 70, reason: "ok", eligible: "unclear", eligibilityReason: "not sure", aiFriendly: "garbage" },
          { id: ids[1], score: 65, reason: "ok", eligible: "unclear", eligibilityReason: "not sure" },
        ]);
      },
    };
    const res = await matchNew(db, stub);
    expect(res.scored).toBe(2);
    const rows = db.listJobs({});
    for (const row of rows) {
      expect(row.aiFriendly).toBeNull();
    }
  });
});
