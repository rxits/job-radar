import { describe, it, expect } from "vitest";
import { runScrape } from "./scrape";
import { createDb } from "./db";
import type { JobSource } from "./types";

const ok: JobSource = { id: "ok", async fetch() {
  return [{ company: "Acme", title: "Eng", location: null, remote: true, salary: null,
    url: "https://x/1", description: "d", postedAt: null, geoRaw: null }];
}};
const boom: JobSource = { id: "boom", async fetch() { throw new Error("down"); } };

describe("runScrape", () => {
  it("stores jobs from healthy sources and isolates failures", async () => {
    const db = createDb(":memory:");
    const res = await runScrape(db, [ok, boom]);
    expect(res.find(r => r.source === "ok")).toMatchObject({ inserted: 1, ok: true });
    expect(res.find(r => r.source === "boom")).toMatchObject({ ok: false });
    expect(db.listJobs({}).length).toBe(1);
  });

  it("is idempotent across runs", async () => {
    const db = createDb(":memory:");
    await runScrape(db, [ok]);
    await runScrape(db, [ok]);
    expect(db.listJobs({}).length).toBe(1);
  });
});
