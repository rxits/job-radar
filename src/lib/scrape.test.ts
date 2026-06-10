import { describe, it, expect } from "vitest";
import { runScrape } from "./scrape";
import { createDb } from "./db";
import type { JobSource } from "./types";

const ok: JobSource = { id: "ok", async fetch() {
  return [{ company: "Acme", title: "Eng", location: null, remote: true, salary: null,
    url: "https://x/1", description: "d", postedAt: null, geoRaw: null }];
}};
const boom: JobSource = { id: "boom", async fetch() { throw new Error("down"); } };

const geoSource: JobSource = { id: "geo", async fetch() {
  return [
    { company: "A", title: "Dev", location: null, remote: true, salary: null,
      url: "https://x/2", description: "d", postedAt: null, geoRaw: "Worldwide" },
    { company: "B", title: "SWE", location: null, remote: true, salary: null,
      url: "https://x/3", description: "d", postedAt: null, geoRaw: "United States" },
  ];
}};

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

  it("classifies geo at scrape time when profile location is set", async () => {
    const db = createDb(":memory:");
    db.saveProfile("resume", "skills", "Chandigarh, India", null, null);
    await runScrape(db, [geoSource]);
    const jobs = db.listJobs({});
    const worldwide = jobs.find(j => j.geoRaw === "Worldwide");
    const usOnly = jobs.find(j => j.geoRaw === "United States");
    expect(worldwide?.eligibility).toBe("eligible");
    expect(usOnly?.eligibility).toBe("ineligible");
  });

  it("leaves eligibility unknown when no profile location", async () => {
    const db = createDb(":memory:");
    // no profile saved at all
    await runScrape(db, [geoSource]);
    const jobs = db.listJobs({});
    expect(jobs.every(j => j.eligibility === "unknown")).toBe(true);
  });
});
