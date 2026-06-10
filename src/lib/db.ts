import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { JobRow, NormalizedJob, Status } from "./types";

export interface JobFilter {
  source?: string; remote?: boolean; minScore?: number; query?: string; status?: Status;
}

export interface Db {
  upsertJobs(jobs: NormalizedJob[]): number;
  listJobs(f: JobFilter): JobRow[];
  unscoredJobs(): JobRow[];
  setStatus(id: string, status: Status): void;
  saveMatch(id: string, score: number, reason: string, model: string): void;
  statusHistory(): { jobId: string; from: string; to: string; changedAt: string }[];
  getProfile(): { resumeText: string; coreSkills: string } | null;
  saveProfile(resumeText: string, coreSkills: string): void;
  raw: Database.Database;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, dedupe_key TEXT UNIQUE NOT NULL, source TEXT NOT NULL,
  company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, remote INTEGER NOT NULL,
  salary TEXT, url TEXT NOT NULL, description TEXT NOT NULL, posted_at TEXT,
  scraped_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'to_apply'
    CHECK (status IN ('to_apply','applied','interviewing','offer','rejected','archived'))
);
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
  from_status TEXT NOT NULL, to_status TEXT NOT NULL, changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  job_id TEXT PRIMARY KEY, score INTEGER NOT NULL, reason TEXT NOT NULL,
  model TEXT NOT NULL, matched_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), resume_text TEXT NOT NULL,
  core_skills TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;

const SELECT = `
SELECT j.id, j.dedupe_key as dedupeKey, j.source, j.company, j.title, j.location,
  j.remote, j.salary, j.url, j.description, j.posted_at as postedAt,
  j.scraped_at as scrapedAt, j.status, m.score, m.reason
FROM jobs j LEFT JOIN matches m ON m.job_id = j.id`;

function toRow(r: any): JobRow {
  return { ...r, remote: !!r.remote, score: r.score ?? null, reason: r.reason ?? null };
}

export function createDb(path = "data/jobradar.db"): Db {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  raw.exec(SCHEMA);

  const insert = raw.prepare(`
    INSERT INTO jobs (id, dedupe_key, source, company, title, location, remote, salary, url, description, posted_at, scraped_at)
    VALUES (@id, @dedupeKey, @source, @company, @title, @location, @remote, @salary, @url, @description, @postedAt, @scrapedAt)
    ON CONFLICT(dedupe_key) DO NOTHING`);

  return {
    raw,
    upsertJobs(jobs) {
      const now = new Date().toISOString();
      const tx = raw.transaction((rows: NormalizedJob[]) => {
        let n = 0;
        for (const j of rows) {
          const res = insert.run({
            id: randomUUID(), dedupeKey: j.dedupeKey, source: j.source, company: j.company,
            title: j.title, location: j.location, remote: j.remote ? 1 : 0, salary: j.salary,
            url: j.url, description: j.description, postedAt: j.postedAt, scrapedAt: now,
          });
          n += res.changes;
        }
        return n;
      });
      return tx(jobs);
    },
    listJobs(f) {
      const where: string[] = []; const p: any = {};
      if (f.source) { where.push("j.source = @source"); p.source = f.source; }
      if (f.remote !== undefined) { where.push("j.remote = @remote"); p.remote = f.remote ? 1 : 0; }
      if (f.status) { where.push("j.status = @status"); p.status = f.status; }
      if (f.minScore !== undefined) { where.push("m.score >= @minScore"); p.minScore = f.minScore; }
      if (f.query) { where.push("(j.company LIKE @q OR j.title LIKE @q OR j.description LIKE @q)"); p.q = `%${f.query}%`; }
      const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY m.score DESC NULLS LAST, j.scraped_at DESC`;
      return raw.prepare(sql).all(p).map(toRow);
    },
    unscoredJobs() {
      return raw.prepare(`${SELECT} WHERE m.job_id IS NULL ORDER BY j.scraped_at DESC`).all().map(toRow);
    },
    setStatus(id, status) {
      const tx = raw.transaction(() => {
        const cur = raw.prepare("SELECT status FROM jobs WHERE id = ?").get(id) as any;
        if (!cur || cur.status === status) return;
        raw.prepare("UPDATE jobs SET status = ? WHERE id = ?").run(status, id);
        raw.prepare("INSERT INTO status_history (job_id, from_status, to_status, changed_at) VALUES (?,?,?,?)")
          .run(id, cur.status, status, new Date().toISOString());
      });
      tx();
    },
    saveMatch(id, score, reason, model) {
      raw.prepare(`INSERT INTO matches (job_id, score, reason, model, matched_at) VALUES (?,?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET score=excluded.score, reason=excluded.reason, model=excluded.model, matched_at=excluded.matched_at`)
        .run(id, score, reason, model, new Date().toISOString());
    },
    statusHistory() {
      return raw.prepare("SELECT job_id as jobId, from_status as 'from', to_status as 'to', changed_at as changedAt FROM status_history ORDER BY changed_at").all() as any;
    },
    getProfile() {
      const r = raw.prepare("SELECT resume_text as resumeText, core_skills as coreSkills FROM profile WHERE id = 1").get() as any;
      return r ?? null;
    },
    saveProfile(resumeText, coreSkills) {
      raw.prepare(`INSERT INTO profile (id, resume_text, core_skills, updated_at) VALUES (1,?,?,?)
        ON CONFLICT(id) DO UPDATE SET resume_text=excluded.resume_text, core_skills=excluded.core_skills, updated_at=excluded.updated_at`)
        .run(resumeText, coreSkills, new Date().toISOString());
    },
  };
}
