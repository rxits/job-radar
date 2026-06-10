import { describe, it, expect, beforeEach } from "vitest";
import { createDb, attachDb, type Db } from "./db";
import type { NormalizedJob } from "./types";

function job(over: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "test", dedupeKey: "k1", company: "Acme", title: "Engineer",
    location: "Remote", remote: true, salary: null, url: "https://x/1",
    description: "desc", postedAt: "2026-06-01T00:00:00Z", geoRaw: null, ...over,
  };
}

describe("db", () => {
  let db: Db;
  beforeEach(() => { db = createDb(":memory:"); });

  it("upserts and lists jobs", () => {
    const n = db.upsertJobs([job(), job({ dedupeKey: "k2", url: "https://x/2" })]);
    expect(n).toBe(2);
    expect(db.listJobs({}).length).toBe(2);
  });

  it("dedupes on dedupeKey", () => {
    db.upsertJobs([job()]);
    db.upsertJobs([job({ title: "Senior Engineer" })]); // same dedupeKey
    expect(db.listJobs({}).length).toBe(1);
  });

  it("sets status and records history", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.setStatus(id, "applied");
    expect(db.listJobs({})[0].status).toBe("applied");
    expect(db.statusHistory().length).toBe(1);
  });

  it("setStatus is a silent no-op for same status or unknown id", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.setStatus(id, "to_apply"); // same as default
    db.setStatus("no-such-id", "applied");
    expect(db.statusHistory().length).toBe(0);
  });

  it("saves and joins match scores", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.saveMatch(id, 87, "great fit", "gemini-2.5-flash");
    const row = db.listJobs({})[0];
    expect(row.score).toBe(87);
    expect(row.reason).toBe("great fit");
  });

  it("returns unscored jobs", () => {
    db.upsertJobs([job(), job({ dedupeKey: "k2", url: "https://x/2" })]);
    const id = db.listJobs({})[0].id;
    db.saveMatch(id, 50, "ok", "gemini-2.5-flash");
    expect(db.unscoredJobs().length).toBe(1);
  });

  it("unscoredJobs excludes rules-rejected ineligible jobs", () => {
    db.upsertJobs([job(), job({ dedupeKey: "k2", url: "https://x/2" })]);
    const id = db.listJobs({})[0].id;
    db.setEligibility(id, "ineligible", "restricted: US");
    expect(db.unscoredJobs().length).toBe(1);
  });

  it("filters by source, remote, minScore, query", () => {
    db.upsertJobs([
      job({ dedupeKey: "a", url: "https://x/a", source: "hn", company: "Alpha", remote: true }),
      job({ dedupeKey: "b", url: "https://x/b", source: "remoteok", company: "Beta", remote: false }),
    ]);
    const ids = db.listJobs({});
    db.saveMatch(ids.find(j => j.company === "Alpha")!.id, 90, "x", "m");
    expect(db.listJobs({ source: "hn" }).length).toBe(1);
    expect(db.listJobs({ remote: true }).length).toBe(1);
    expect(db.listJobs({ minScore: 80 }).length).toBe(1);
    expect(db.listJobs({ query: "alph" }).length).toBe(1);
  });

  it("saves and reads profile", () => {
    db.saveProfile("resume text", "ts, react");
    expect(db.getProfile()).toMatchObject({ resumeText: "resume text", coreSkills: "ts, react" });
  });

  it("saveTailored/getTailored round-trip", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.saveTailored(id, "# Alice\n\nSummary", "gemini-2.5-pro");
    const t = db.getTailored(id);
    expect(t).not.toBeNull();
    expect(t!.markdown).toBe("# Alice\n\nSummary");
    expect(t!.model).toBe("gemini-2.5-pro");
    expect(t!.createdAt).toBeTruthy();
  });

  it("saveTailored upsert: second save overwrites first", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.saveTailored(id, "v1", "gemini-2.5-pro");
    db.saveTailored(id, "v2", "gemini-2.5-flash");
    const t = db.getTailored(id);
    expect(t!.markdown).toBe("v2");
    expect(t!.model).toBe("gemini-2.5-flash");
  });

  it("getTailored returns null for unknown id", () => {
    expect(db.getTailored("no-such-id")).toBeNull();
  });

  it("getJob returns row with hasTailored false initially, true after saveTailored", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    const before = db.getJob(id);
    expect(before).not.toBeNull();
    expect(before!.id).toBe(id);
    expect(before!.hasTailored).toBe(false);
    db.saveTailored(id, "md", "gemini-2.5-pro");
    const after = db.getJob(id);
    expect(after!.hasTailored).toBe(true);
  });

  it("getJob returns null for unknown id", () => {
    expect(db.getJob("no-such-id")).toBeNull();
  });

  it("migrates a v1 database in place", () => {
    // simulate v1: create db with old schema by hand
    const Database = require("better-sqlite3");
    const raw = new Database(":memory:");
    raw.exec(`CREATE TABLE jobs (id TEXT PRIMARY KEY, dedupe_key TEXT UNIQUE NOT NULL, source TEXT NOT NULL,
      company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, remote INTEGER NOT NULL, salary TEXT,
      url TEXT NOT NULL, description TEXT NOT NULL, posted_at TEXT, scraped_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'to_apply');
      CREATE TABLE matches (job_id TEXT PRIMARY KEY, score INTEGER NOT NULL, reason TEXT NOT NULL, model TEXT NOT NULL, matched_at TEXT NOT NULL);
      CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK (id = 1), resume_text TEXT NOT NULL, core_skills TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, from_status TEXT NOT NULL, to_status TEXT NOT NULL, changed_at TEXT NOT NULL);`);
    raw.prepare("INSERT INTO jobs (id, dedupe_key, source, company, title, remote, url, description, scraped_at) VALUES ('a','k','s','C','T',1,'u','d','2026-01-01')").run();
    const migratedDb = attachDb(raw);
    const row = migratedDb.listJobs({})[0];
    expect(row.eligibility).toBe("unknown");
    expect(row.starred).toBe(false);
  });

  it("persists eligibility", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.setEligibility(id, "ineligible", "restricted to US");
    const row = db.listJobs({ eligibility: ["ineligible"] })[0];
    expect(row.eligibilityReason).toBe("restricted to US");
    expect(db.listJobs({ eligibility: ["eligible"] }).length).toBe(0);
  });

  it("saveMatch stores aiFriendly", () => {
    db.upsertJobs([job()]);
    const id = db.listJobs({})[0].id;
    db.saveMatch(id, 80, "fit", "m", 70);
    expect(db.listJobs({})[0].aiFriendly).toBe(70);
  });

  it("saveProfile stores location/timezone/preferences", () => {
    db.saveProfile("r", "s", "Chandigarh, India", "IST", "eng roles");
    expect(db.getProfile()).toMatchObject({ location: "Chandigarh, India", timezone: "IST", preferences: "eng roles" });
  });

  it("upsertJobs persists geoRaw", () => {
    db.upsertJobs([job({ geoRaw: "Worldwide" })]);
    expect(db.listJobs({})[0].geoRaw).toBe("Worldwide");
  });

  it("recentActivity returns rows newest-first with company/title/from/to", () => {
    db.upsertJobs([
      job({ dedupeKey: "ra1", url: "https://x/ra1", company: "Acme", title: "Engineer" }),
      job({ dedupeKey: "ra2", url: "https://x/ra2", company: "Beta", title: "Designer" }),
    ]);
    const [job1, job2] = db.listJobs({}).sort((a, b) =>
      (a.company < b.company ? -1 : 1)
    ); // job1=Acme, job2=Beta
    db.setStatus(job1.id, "applied");
    db.setStatus(job1.id, "interviewing");
    db.setStatus(job2.id, "applied");

    const rows = db.recentActivity();
    expect(rows.length).toBe(3);
    // newest first: job2 applied is last inserted
    expect(rows[0].company).toBe("Beta");
    expect(rows[0].from).toBe("to_apply");
    expect(rows[0].to).toBe("applied");
    // all rows have truthy company and title
    for (const r of rows) {
      expect(r.company).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.from).toBeTruthy();
      expect(r.to).toBeTruthy();
    }
    // second row is job1 interviewing
    expect(rows[1].company).toBe("Acme");
    expect(rows[1].from).toBe("applied");
    expect(rows[1].to).toBe("interviewing");
    // third row is job1 applied
    expect(rows[2].company).toBe("Acme");
    expect(rows[2].from).toBe("to_apply");
    expect(rows[2].to).toBe("applied");
  });
});
