import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Contact, Eligibility, JobRow, Kit, NormalizedJob, Status } from "./types";
import { detectInternship, payTier, regionOf } from "./classify";

export interface JobFilter {
  source?: string; remote?: boolean; minScore?: number; query?: string; status?: Status;
  eligibility?: Eligibility[];
  unseenOnly?: boolean;
  starred?: boolean;
  actioned?: boolean;
  region?: string;
  payTier?: string;
  internship?: boolean;
}

export interface Db {
  upsertJobs(jobs: NormalizedJob[]): number;
  listJobs(f: JobFilter): JobRow[];
  unscoredJobs(): JobRow[];
  setStatus(id: string, status: Status): void;
  markSeen(id: string): void;
  setStarred(id: string, starred: boolean): void;
  needsFollowUp(days?: number): JobRow[];
  saveMatch(id: string, score: number, reason: string, model: string, aiFriendly?: number | null): void;
  setEligibility(id: string, e: Eligibility, reason: string | null): void;
  statusHistory(): { jobId: string; from: string; to: string; changedAt: string }[];
  recentActivity(limit?: number): { company: string; title: string; from: string; to: string; changedAt: string }[];
  getProfile(): { resumeText: string; coreSkills: string; location: string | null; timezone: string | null; preferences: string | null } | null;
  saveProfile(resumeText: string, coreSkills: string, location?: string | null, timezone?: string | null, preferences?: string | null): void;
  saveTailored(jobId: string, markdown: string, model: string): void;
  getTailored(jobId: string): { markdown: string; model: string; createdAt: string } | null;
  saveKit(jobId: string, kit: { resumeMd: string; coverMd: string; outreachMd: string }, model: string): void;
  getKit(jobId: string): Kit | null;
  getJob(id: string): JobRow | null;
  saveContact(c: Contact, model: string): void;
  getContact(jobId: string): Contact | null;
  raw: Database.Database;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, dedupe_key TEXT UNIQUE NOT NULL, source TEXT NOT NULL,
  company TEXT NOT NULL, title TEXT NOT NULL, location TEXT, remote INTEGER NOT NULL,
  salary TEXT, url TEXT NOT NULL, description TEXT NOT NULL, posted_at TEXT,
  scraped_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'to_apply'
    CHECK (status IN ('to_apply','applied','interviewing','offer','rejected','archived')),
  geo_raw TEXT,
  eligibility TEXT NOT NULL DEFAULT 'unknown',
  eligibility_reason TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT,
  is_internship INTEGER NOT NULL DEFAULT 0,
  pay_tier TEXT,
  region TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  job_id TEXT PRIMARY KEY, company TEXT, person_name TEXT, person_title TEXT,
  emails TEXT, links TEXT, source TEXT, confidence TEXT, model TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL,
  from_status TEXT NOT NULL, to_status TEXT NOT NULL, changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  job_id TEXT PRIMARY KEY, score INTEGER NOT NULL, reason TEXT NOT NULL,
  model TEXT NOT NULL, matched_at TEXT NOT NULL,
  ai_friendly INTEGER
);
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1), resume_text TEXT NOT NULL,
  core_skills TEXT NOT NULL, updated_at TEXT NOT NULL,
  location TEXT, timezone TEXT, preferences TEXT
);
CREATE TABLE IF NOT EXISTS tailored (
  job_id TEXT PRIMARY KEY, markdown TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kits (
  job_id TEXT PRIMARY KEY, resume_md TEXT NOT NULL, cover_md TEXT NOT NULL,
  outreach_md TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
);
`;

const USER_VERSION = 4;

function migrate(raw: Database.Database) {
  raw.exec(SCHEMA); // fresh DBs get full v2 shape via IF NOT EXISTS tables
  const v = raw.pragma("user_version", { simple: true }) as number;
  if (v < USER_VERSION) {
    const addCol = (table: string, ddl: string) => {
      try { raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`); } catch { /* column exists */ }
    };
    addCol("jobs", "geo_raw TEXT");
    addCol("jobs", "eligibility TEXT NOT NULL DEFAULT 'unknown'");
    addCol("jobs", "eligibility_reason TEXT");
    addCol("jobs", "starred INTEGER NOT NULL DEFAULT 0");
    addCol("jobs", "seen_at TEXT");
    addCol("matches", "ai_friendly INTEGER");
    addCol("profile", "location TEXT");
    addCol("profile", "timezone TEXT");
    addCol("profile", "preferences TEXT");
    raw.exec(`CREATE TABLE IF NOT EXISTS kits (
      job_id TEXT PRIMARY KEY, resume_md TEXT NOT NULL, cover_md TEXT NOT NULL,
      outreach_md TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
    // v4: internship/pay/region classification + contacts
    addCol("jobs", "is_internship INTEGER NOT NULL DEFAULT 0");
    addCol("jobs", "pay_tier TEXT");
    addCol("jobs", "region TEXT");
    raw.exec(`CREATE TABLE IF NOT EXISTS contacts (
      job_id TEXT PRIMARY KEY, company TEXT, person_name TEXT, person_title TEXT,
      emails TEXT, links TEXT, source TEXT, confidence TEXT, model TEXT, created_at TEXT
    )`);
    raw.pragma(`user_version = ${USER_VERSION}`);
  }
}

// One-time backfill: classify pre-v4 rows (region/pay_tier left NULL by the migration)
// so existing jobs are immediately rankable. Cheap and idempotent (only touches NULL rows).
function backfillClassification(raw: Database.Database) {
  const rows = raw.prepare(
    "SELECT id, title, description, salary, location, geo_raw as geoRaw FROM jobs WHERE region IS NULL AND pay_tier IS NULL"
  ).all() as any[];
  if (rows.length === 0) return;
  const upd = raw.prepare("UPDATE jobs SET is_internship = ?, pay_tier = ?, region = ? WHERE id = ?");
  const tx = raw.transaction((items: any[]) => {
    for (const r of items) {
      upd.run(
        detectInternship(r.title, r.description) ? 1 : 0,
        payTier(r.salary),
        regionOf(r.location, r.geoRaw),
        r.id,
      );
    }
  });
  tx(rows);
}

const SELECT = `
SELECT j.id, j.dedupe_key as dedupeKey, j.source, j.company, j.title, j.location,
  j.remote, j.salary, j.url, j.description, j.posted_at as postedAt,
  j.scraped_at as scrapedAt, j.status, m.score, m.reason,
  t.job_id IS NOT NULL as hasTailored,
  k.job_id IS NOT NULL as hasKit,
  j.geo_raw as geoRaw, j.eligibility, j.eligibility_reason as eligibilityReason,
  j.starred, j.seen_at as seenAt, m.ai_friendly as aiFriendly,
  j.is_internship as isInternship, j.pay_tier as payTier, j.region as region
FROM jobs j LEFT JOIN matches m ON m.job_id = j.id
LEFT JOIN tailored t ON t.job_id = j.id
LEFT JOIN kits k ON k.job_id = j.id`;

function toRow(r: any): JobRow {
  return {
    ...r,
    remote: !!r.remote,
    score: r.score ?? null,
    reason: r.reason ?? null,
    hasTailored: !!r.hasTailored,
    hasKit: !!r.hasKit,
    starred: !!r.starred,
    aiFriendly: r.aiFriendly ?? null,
    geoRaw: r.geoRaw ?? null,
    eligibilityReason: r.eligibilityReason ?? null,
    seenAt: r.seenAt ?? null,
    isInternship: !!r.isInternship,
    payTier: r.payTier ?? null,
    region: r.region ?? null,
  };
}

export function attachDb(raw: Database.Database): Db {
  migrate(raw);
  backfillClassification(raw);

  const insert = raw.prepare(`
    INSERT INTO jobs (id, dedupe_key, source, company, title, location, remote, salary, url, description, posted_at, scraped_at, geo_raw, is_internship, pay_tier, region)
    VALUES (@id, @dedupeKey, @source, @company, @title, @location, @remote, @salary, @url, @description, @postedAt, @scrapedAt, @geoRaw, @isInternship, @payTier, @region)
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
            geoRaw: j.geoRaw ?? null,
            isInternship: detectInternship(j.title, j.description) ? 1 : 0,
            payTier: payTier(j.salary),
            region: regionOf(j.location, j.geoRaw),
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
      if (f.eligibility && f.eligibility.length > 0) {
        const placeholders = f.eligibility.map((_, i) => `@elig${i}`).join(", ");
        where.push(`j.eligibility IN (${placeholders})`);
        f.eligibility.forEach((e, i) => { p[`elig${i}`] = e; });
      }
      if (f.unseenOnly) { where.push("j.seen_at IS NULL"); }
      if (f.starred) { where.push("j.starred = 1"); }
      if (f.actioned) { where.push("(j.status != 'to_apply' OR j.starred = 1)"); }
      if (f.region) { where.push("j.region = @region"); p.region = f.region; }
      if (f.payTier) { where.push("j.pay_tier = @payTier"); p.payTier = f.payTier; }
      if (f.internship !== undefined) { where.push("j.is_internship = @internship"); p.internship = f.internship ? 1 : 0; }
      // high-pay roles float to the top, then by score / ai-friendliness / recency
      const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY (j.pay_tier = 'high') DESC, m.score DESC NULLS LAST, m.ai_friendly DESC NULLS LAST, j.scraped_at DESC`;
      return raw.prepare(sql).all(p).map(toRow);
    },
    unscoredJobs() {
      // rules-engine-rejected jobs are excluded — no Gemini quota on ruled-out jobs
      return raw
        .prepare(`${SELECT} WHERE m.job_id IS NULL AND j.eligibility != 'ineligible' ORDER BY j.scraped_at DESC`)
        .all()
        .map(toRow);
    },
    markSeen(id) {
      raw.prepare("UPDATE jobs SET seen_at = ? WHERE id = ? AND seen_at IS NULL")
        .run(new Date().toISOString(), id);
    },
    setStarred(id, starred) {
      raw.prepare("UPDATE jobs SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
    },
    needsFollowUp(days = 7) {
      return raw.prepare(
        `${SELECT} WHERE j.status = 'applied' AND NOT EXISTS (
          SELECT 1 FROM status_history h WHERE h.job_id = j.id AND h.changed_at > datetime('now', '-' || ? || ' days')
        ) ORDER BY m.score DESC NULLS LAST, m.ai_friendly DESC NULLS LAST, j.scraped_at DESC`
      ).all(days).map(toRow);
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
    setEligibility(id, e, reason) {
      raw.prepare("UPDATE jobs SET eligibility = ?, eligibility_reason = ? WHERE id = ?")
        .run(e, reason, id);
    },
    saveMatch(id, score, reason, model, aiFriendly) {
      raw.prepare(`INSERT INTO matches (job_id, score, reason, model, matched_at, ai_friendly) VALUES (?,?,?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET score=excluded.score, reason=excluded.reason, model=excluded.model, matched_at=excluded.matched_at, ai_friendly=excluded.ai_friendly`)
        .run(id, score, reason, model, new Date().toISOString(), aiFriendly ?? null);
    },
    statusHistory() {
      return raw.prepare("SELECT job_id as jobId, from_status as 'from', to_status as 'to', changed_at as changedAt FROM status_history ORDER BY changed_at").all() as any;
    },
    recentActivity(limit = 20) {
      return raw.prepare(
        `SELECT j.company, j.title, h.from_status as 'from', h.to_status as 'to', h.changed_at as changedAt
         FROM status_history h JOIN jobs j ON j.id = h.job_id
         ORDER BY h.changed_at DESC, h.id DESC LIMIT ?`
      ).all(limit) as any;
    },
    getProfile() {
      const r = raw.prepare("SELECT resume_text as resumeText, core_skills as coreSkills, location, timezone, preferences FROM profile WHERE id = 1").get() as any;
      if (!r) return null;
      return {
        resumeText: r.resumeText,
        coreSkills: r.coreSkills,
        location: r.location ?? null,
        timezone: r.timezone ?? null,
        preferences: r.preferences ?? null,
      };
    },
    saveProfile(resumeText, coreSkills, location, timezone, preferences) {
      raw.prepare(`INSERT INTO profile (id, resume_text, core_skills, updated_at, location, timezone, preferences) VALUES (1,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET resume_text=excluded.resume_text, core_skills=excluded.core_skills, updated_at=excluded.updated_at, location=excluded.location, timezone=excluded.timezone, preferences=excluded.preferences`)
        .run(resumeText, coreSkills, new Date().toISOString(), location ?? null, timezone ?? null, preferences ?? null);
    },
    saveTailored(jobId, markdown, model) {
      raw.prepare(`INSERT INTO tailored (job_id, markdown, model, created_at) VALUES (?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET markdown=excluded.markdown, model=excluded.model, created_at=excluded.created_at`)
        .run(jobId, markdown, model, new Date().toISOString());
    },
    getTailored(jobId) {
      const r = raw.prepare("SELECT markdown, model, created_at as createdAt FROM tailored WHERE job_id = ?").get(jobId) as any;
      return r ?? null;
    },
    saveKit(jobId, kit, model) {
      raw.prepare(`INSERT INTO kits (job_id, resume_md, cover_md, outreach_md, model, created_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET resume_md=excluded.resume_md, cover_md=excluded.cover_md, outreach_md=excluded.outreach_md, model=excluded.model, created_at=excluded.created_at`)
        .run(jobId, kit.resumeMd, kit.coverMd, kit.outreachMd, model, new Date().toISOString());
    },
    getKit(jobId) {
      const r = raw.prepare("SELECT resume_md as resumeMd, cover_md as coverMd, outreach_md as outreachMd, model, created_at as createdAt FROM kits WHERE job_id = ?").get(jobId) as any;
      return r ?? null;
    },
    getJob(id) {
      const r = raw.prepare(`${SELECT} WHERE j.id = ?`).get(id) as any;
      return r ? toRow(r) : null;
    },
    saveContact(c, model) {
      raw.prepare(`INSERT INTO contacts (job_id, company, person_name, person_title, emails, links, source, confidence, model, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET company=excluded.company, person_name=excluded.person_name, person_title=excluded.person_title, emails=excluded.emails, links=excluded.links, source=excluded.source, confidence=excluded.confidence, model=excluded.model, created_at=excluded.created_at`)
        .run(c.jobId, c.company, c.personName, c.personTitle, JSON.stringify(c.emails), JSON.stringify(c.links), c.source, c.confidence, model, new Date().toISOString());
    },
    getContact(jobId) {
      const r = raw.prepare("SELECT job_id as jobId, company, person_name as personName, person_title as personTitle, emails, links, source, confidence FROM contacts WHERE job_id = ?").get(jobId) as any;
      if (!r) return null;
      const parse = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
      return { ...r, emails: parse(r.emails), links: parse(r.links) } as Contact;
    },
  };
}

export function createDb(path = "data/jobradar.db"): Db {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  return attachDb(raw);
}
