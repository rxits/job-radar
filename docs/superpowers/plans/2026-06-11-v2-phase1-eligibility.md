# job-radar v2 Phase 1 — Eligibility Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every job gets an eligibility verdict (eligible/ineligible/unknown) for the candidate's location, four new worldwide-friendly sources land, and matching also judges eligibility + AI-friendliness — so the dashboard stops showing jobs the user cannot apply to.

**Architecture:** SQLite migration runner (PRAGMA user_version) adds v2 columns in place. A pure-function rules engine classifies structured geo text at scrape time; the existing Gemini flash batch judges the leftovers (and AI-friendliness) at match time — same calls, richer output. Four new `JobSource` implementations follow the v1 fixture-TDD pattern.

**Tech Stack:** unchanged (Next.js 15, better-sqlite3, @google/genai 2.8, vitest). New dev-only need: none (WWR RSS parsed with a small regex parser, no XML dependency).

**Spec:** `docs/superpowers/specs/2026-06-11-job-radar-v2-design.md` (Phase 1 section). Sibling patterns: `src/lib/sources/remoteok.ts` (API source), `src/lib/sources/hn-hiring.ts` (text parsing), all tests fixture-based, no live network in tests.

**Verified live (2026-06-11):** Remotive `candidate_required_location`, Jobicy `jobGeo`, Himalayas `locationRestrictions[]`, WWR category RSS all respond. Candidate config example: location "Chandigarh, India", timezone "IST (UTC+5:30)".

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/types.ts` (modify) | +`geoRaw` on RawJob; +`geoRaw, eligibility, eligibilityReason, starred, aiFriendly` on JobRow; `Eligibility` type; MatchResult v2 |
| `src/lib/db.ts` (modify) | migration runner; new columns; `setEligibility`, `saveMatch(+aiFriendly)`, `saveProfile(+location/timezone/preferences)`, `listJobs(+eligibility filter)` |
| `src/lib/eligibility.ts` (create) | pure rules: `classifyGeo(geoRaw, candidateLocation)` |
| `src/lib/sources/remotive.ts` + test + fixture | Remotive API source |
| `src/lib/sources/jobicy.ts` + test + fixture | Jobicy API source |
| `src/lib/sources/himalayas.ts` + test + fixture | Himalayas API source |
| `src/lib/sources/wwr.ts` + test + fixture | We Work Remotely RSS source |
| `src/lib/sources/index.ts` (modify) | register 4 new sources |
| `src/lib/sources/remoteok.ts` (modify) | `geoRaw: location` (RemoteOK's location IS a restriction) |
| `src/lib/sources/hn-hiring.ts`, `hn-jobs.ts` (modify) | `geoRaw: null` |
| `src/lib/scrape.ts` (modify) | apply `classifyGeo` rules at insert time |
| `src/lib/match.ts` (modify) | prompt v2: + candidate context; returns eligible/eligibilityReason/aiFriendly; persists |
| `src/app/api/jobs/route.ts` (modify) | `eligibility` query param |
| `src/app/board.tsx` (modify) | default to eligible+unknown; eligibility badge on cards; filter select |
| `scripts/scrape.ts` (modify) | eligibility breakdown line |

---

### Task 1: Types v2

**Files:** Modify: `src/lib/types.ts`

- [ ] **Step 1: Apply the type changes**

```ts
// add:
export type Eligibility = "eligible" | "ineligible" | "unknown";

// RawJob: add field
  geoRaw: string | null; // source-provided location-restriction text, null if none

// JobRow: add fields
  eligibility: Eligibility;
  eligibilityReason: string | null;
  starred: boolean;
  seenAt: string | null;
  aiFriendly: number | null;

// MatchResult becomes:
export interface MatchResult {
  id: string;
  score: number;
  reason: string;
  eligible: "yes" | "no" | "unclear";
  eligibilityReason: string;
  aiFriendly: number;
}
```

- [ ] **Step 2:** `pnpm exec tsc --noEmit` — EXPECT ERRORS in db.ts/sources/match tests (consumers don't set the new fields yet). That's fine — Tasks 2–8 fix them; this task only commits once paired with Task 2 (single commit there). Do NOT commit yet.

### Task 2: DB migrations + v2 methods (TDD)

**Files:** Modify: `src/lib/db.ts`, `src/lib/db.test.ts`. Also touch source files minimally so tsc passes: add `geoRaw: null` to the RawJob literals in `remoteok.ts` (use `geoRaw: location` — see Task 7b), `hn-hiring.ts`, `hn-jobs.ts`, and to test factory objects in `db.test.ts`, `scrape.test.ts`, `match.test.ts`, `tailor` n/a.

- [ ] **Step 1: Write failing tests** (add to `src/lib/db.test.ts`)

```ts
it("migrates a v1 database in place", () => {
  // simulate v1: create db, drop v2 columns is impossible — instead build a raw v1 schema by hand
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
  const db = attachDb(raw); // new export: attach to an existing connection (createDb uses it internally)
  const row = db.listJobs({})[0];
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
```

- [ ] **Step 2:** Run — FAIL (attachDb/setEligibility missing).

- [ ] **Step 3: Implement in db.ts**

```ts
// SCHEMA: jobs gains (fresh-create path):
//   geo_raw TEXT, eligibility TEXT NOT NULL DEFAULT 'unknown', eligibility_reason TEXT,
//   starred INTEGER NOT NULL DEFAULT 0, seen_at TEXT
// matches gains: ai_friendly INTEGER
// profile gains: location TEXT, timezone TEXT, preferences TEXT

const USER_VERSION = 2;
function migrate(raw: Database.Database) {
  raw.exec(SCHEMA); // fresh DBs get full v2 shape
  const v = raw.pragma("user_version", { simple: true }) as number;
  if (v < 2) {
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
    raw.pragma(`user_version = ${USER_VERSION}`);
  }
}

export function attachDb(raw: Database.Database): Db { /* body of current createDb minus `new Database`, plus migrate(raw) first */ }
export function createDb(path = "data/jobradar.db"): Db {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");
  return attachDb(raw);
}
```

SELECT adds: `j.geo_raw as geoRaw, j.eligibility, j.eligibility_reason as eligibilityReason, j.starred, j.seen_at as seenAt, m.ai_friendly as aiFriendly`. `toRow` adds `starred: !!r.starred, aiFriendly: r.aiFriendly ?? null, geoRaw: r.geoRaw ?? null, eligibilityReason: r.eligibilityReason ?? null, seenAt: r.seenAt ?? null`. insert statement + upsertJobs map `geoRaw`. New methods on Db interface + impl:

```ts
setEligibility(id: string, e: Eligibility, reason: string | null): void;
// UPDATE jobs SET eligibility = ?, eligibility_reason = ? WHERE id = ?
saveMatch(id: string, score: number, reason: string, model: string, aiFriendly?: number | null): void;
// add ai_friendly column to INSERT ... ON CONFLICT DO UPDATE
saveProfile(resumeText: string, coreSkills: string, location?: string | null, timezone?: string | null, preferences?: string | null): void;
getProfile(): { resumeText; coreSkills; location: string | null; timezone: string | null; preferences: string | null } | null;
```
JobFilter gains `eligibility?: Eligibility[]` → WHERE `j.eligibility IN (...)` (expand placeholders).

- [ ] **Step 4:** Full `pnpm test` green + tsc clean (after adding `geoRaw` to the source literals and test factories listed in Files).
- [ ] **Step 5:** `git add -A && git commit -m "v2 schema: migrations, eligibility/starred/aiFriendly columns, profile location"`

### Task 3: Eligibility rules engine (TDD)

**Files:** Create: `src/lib/eligibility.ts`, `src/lib/eligibility.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { classifyGeo } from "./eligibility";

const IN = "Chandigarh, India";
describe("classifyGeo", () => {
  it("worldwide markers are eligible", () => {
    for (const g of ["Worldwide", "Anywhere", "Remote - Global", "anywhere in the world"])
      expect(classifyGeo(g, IN).eligibility).toBe("eligible");
  });
  it("candidate country/region named is eligible", () => {
    for (const g of ["India", "Asia only", "APAC", "EMEA & APAC"])
      expect(classifyGeo(g, IN).eligibility).toBe("eligible");
  });
  it("other-region restrictions are ineligible with reason", () => {
    const r = classifyGeo("United States", IN);
    expect(r.eligibility).toBe("ineligible");
    expect(r.reason).toContain("United States");
    for (const g of ["USA only", "UK", "Canada", "EU timezones", "Europe", "LATAM"])
      expect(classifyGeo(g, IN).eligibility).toBe("ineligible");
  });
  it("null/empty/ambiguous is unknown", () => {
    expect(classifyGeo(null, IN).eligibility).toBe("unknown");
    expect(classifyGeo("", IN).eligibility).toBe("unknown");
    expect(classifyGeo("flexible", IN).eligibility).toBe("unknown");
  });
  it("mixed lists: any eligible token wins", () => {
    expect(classifyGeo("USA, India, UK", IN).eligibility).toBe("eligible");
  });
  it("different candidate location changes the verdict", () => {
    expect(classifyGeo("EU timezones", "Berlin, Germany").eligibility).toBe("eligible");
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**

```ts
import type { Eligibility } from "./types";

const WORLDWIDE_RE = /\bworldwide\b|\banywhere\b|\bglobal(ly)?\b|\binternational\b|\bany\s*country\b|\bany\s*location\b/i;
// country → tokens that make a geo string eligible for that candidate
const REGION_TOKENS: Record<string, RegExp> = {
  india: /\bindia\b|\bapac\b|\basia\b|\bsouth asia\b|\bist\b/i,
  germany: /\bgermany\b|\beurope\b|\beu\b|\bemea\b|\beu time ?zones?\b|\bcet\b/i,
  // extensible; OSS users add their country here or rely on name match
};
// known restriction tokens that signal a real region limit (so we can call ineligible confidently)
const RESTRICTION_RE = /\bus(a)?\b|\bunited states\b|\bcanada\b|\buk\b|\bunited kingdom\b|\beurope\b|\beu\b|\bemea\b|\blatam\b|\bamericas?\b|\baustralia\b|\bnew zealand\b|\bafrica\b|\basia\b|\bapac\b|\bindia\b|\bgermany\b|\bfrance\b|\bnetherlands\b|\bspain\b|\bpoland\b|\bbrazil\b|\bmexico\b|\bjapan\b|\bsingapore\b|\bphilippines\b|\b[a-z ]*time ?zones?\b|\bonly\b/i;

function candidateRegexes(candidateLocation: string): RegExp[] {
  const lower = candidateLocation.toLowerCase();
  const res: RegExp[] = [];
  for (const [country, re] of Object.entries(REGION_TOKENS)) if (lower.includes(country)) res.push(re);
  // always also match the candidate's own country word(s) from the location string (last comma segment)
  const country = lower.split(",").pop()?.trim();
  if (country) res.push(new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  return res;
}

export function classifyGeo(geoRaw: string | null, candidateLocation: string): { eligibility: Eligibility; reason: string | null } {
  const g = (geoRaw ?? "").trim();
  if (!g) return { eligibility: "unknown", reason: null };
  if (WORLDWIDE_RE.test(g)) return { eligibility: "eligible", reason: `open worldwide (“${g}”)` };
  if (candidateRegexes(candidateLocation).some((re) => re.test(g)))
    return { eligibility: "eligible", reason: `region includes you (“${g}”)` };
  if (RESTRICTION_RE.test(g)) return { eligibility: "ineligible", reason: `restricted: ${g}` };
  return { eligibility: "unknown", reason: g };
}
```

- [ ] **Step 4:** PASS + tsc clean. **Step 5:** `git add src/lib/eligibility.* && git commit -m "add geo eligibility rules engine"`

### Task 4: Remotive source (fixture TDD)

**Files:** Create: `src/lib/sources/remotive.ts`, `.test.ts`, `test/fixtures/remotive.json`

- [ ] Fixture: `curl -s "https://remotive.com/api/remote-jobs?limit=8" > test/fixtures/remotive.json` (trim not needed at limit=8).
- [ ] Failing test: parses fixture → length>0; fields: company=`company_name`, title=`title`, url=`url`, geoRaw=`candidate_required_location||null`, salary=`salary||null`, postedAt via safeDateISO(`publication_date`), remote=true, description = `description` (HTML, slice 4000), location=`candidate_required_location`.
- [ ] Implement `parseRemotive(rows)` + `remotiveSource: JobSource` (id "remotive", GET `https://remotive.com/api/remote-jobs?limit=200`, payload `.jobs` array, throw on !ok). Follow remoteok.ts shape exactly (incl. safeDateISO).
- [ ] Tests green, tsc clean, commit `add remotive source`.

### Task 5: Jobicy source (fixture TDD)

**Files:** Create: `src/lib/sources/jobicy.ts`, `.test.ts`, `test/fixtures/jobicy.json`

- [ ] Fixture: `curl -s "https://jobicy.com/api/v2/remote-jobs?count=8" > test/fixtures/jobicy.json`.
- [ ] Failing test + implement: payload `.jobs`; company=`companyName`, title=`jobTitle`, url=`url`, geoRaw=`jobGeo||null` (note: "Anywhere" is their worldwide marker — rules engine already handles it), salary: `annualSalaryMin/Max` joined when both >0 (`$min–$max`), postedAt via safeDateISO(`pubDate`), description=`jobExcerpt||jobDescription` slice 4000, location=`jobGeo`, remote=true. id "jobicy", fetch `https://jobicy.com/api/v2/remote-jobs?count=100`.
- [ ] Green, commit `add jobicy source`.

### Task 6: Himalayas source (fixture TDD)

**Files:** Create: `src/lib/sources/himalayas.ts`, `.test.ts`, `test/fixtures/himalayas.json`

- [ ] Fixture: `curl -s "https://himalayas.app/jobs/api?limit=8" > test/fixtures/himalayas.json`.
- [ ] Failing test + implement: payload `.jobs`; company=`companyName`, title=`title`, url=`applicationLink||guid`, geoRaw = `locationRestrictions.length ? locationRestrictions.join(", ") : "Worldwide"` (empty array = unrestricted per their docs), salary: `minSalary/maxSalary` if both >0, postedAt via safeDateISO(`pubDate` — epoch seconds: multiply ×1000 if numeric), description=`description` slice 4000, location = geoRaw, remote=true. id "himalayas", fetch `https://himalayas.app/jobs/api?limit=100`.
- [ ] Green, commit `add himalayas source`.

### Task 7: We Work Remotely RSS source (fixture TDD)

**Files:** Create: `src/lib/sources/wwr.ts`, `.test.ts`, `test/fixtures/wwr.xml`

- [ ] Fixture: `curl -s -H "User-Agent: job-radar" "https://weworkremotely.com/categories/remote-programming-jobs.rss" > test/fixtures/wwr.xml`.
- [ ] Failing test + implement. Parse RSS with regex (no new deps), per `<item>` block:

```ts
export function parseWwr(xml: string): RawJob[] {
  const items = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);
  const tag = (s: string, t: string) => {
    const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : null;
  };
  return items.flatMap((it) => {
    const rawTitle = tag(it, "title") ?? "";           // "Company: Role"
    const [company, ...rest] = rawTitle.split(":");
    const title = rest.join(":").trim();
    if (!company || !title) return [];
    const region = tag(it, "region");
    const desc = stripHtmlEntities(tag(it, "description") ?? "").slice(0, 4000);
    return [{
      company: company.trim().slice(0, 120),
      title: title.slice(0, 160),
      location: region, remote: true, salary: null,
      url: tag(it, "link") ?? "", geoRaw: region,
      description: desc, postedAt: safeDateISO(tag(it, "pubDate")),
    }];
  }).filter((j) => j.url);
}
```
`stripHtmlEntities`: reuse the entity-decode approach from hn-hiring's stripHtml (copy the small helper locally or export stripHtml from hn-hiring — prefer exporting it as `stripHtml` from `src/lib/normalize.ts` and updating hn-hiring to import it, keeping one copy). `wwrSource` id "wwr" fetches programming + devops-sysadmin + all other dev category feeds? **v2 scope: just two feeds** — `remote-programming-jobs.rss` and `remote-devops-sysadmin-jobs.rss`, concatenated.
- [ ] Green, commit `add we-work-remotely rss source`.

### Task 7b: Existing sources emit geoRaw + registry

**Files:** Modify: `src/lib/sources/remoteok.ts` (`geoRaw: location` — same cleaned value), `hn-hiring.ts`/`hn-jobs.ts` (`geoRaw: null` — free text handled by Gemini), `src/lib/sources/index.ts`:

```ts
export const sources: JobSource[] = [hnHiringSource, remoteOkSource, hnJobsSource, remotiveSource, jobicySource, himalayasSource, wwrSource];
```
- [ ] Full suite green, tsc clean, commit `wire new sources into registry`.

### Task 8: Scrape-time rules + match-time Gemini eligibility (TDD)

**Files:** Modify: `src/lib/scrape.ts`, `src/lib/scrape.test.ts`, `src/lib/match.ts`, `src/lib/match.test.ts`

- [ ] **scrape.ts**: after upsert, classify *newly relevant* jobs: for every job in `db.listJobs({})` with `eligibility === "unknown" && geoRaw` (cheap at this scale), run `classifyGeo(j.geoRaw, candidateLocation)` and `setEligibility` when verdict ≠ unknown. Candidate location comes from `db.getProfile()?.location ?? ""` — empty location leaves everything unknown (Gemini still judges at match time). Test: stub source emits geoRaw "Worldwide" and "United States"; profile location "India"; after runScrape, jobs carry eligible/ineligible respectively.
- [ ] **match.ts** prompt v2 — batchPrompt gains candidate block and asks for the extended object:

```
CANDIDATE LOCATION: ${profile.location ?? "unknown"} (timezone ${profile.timezone ?? "unknown"})
CANDIDATE PREFERENCES: ${profile.preferences ?? "none stated"}
...
Return ONLY a JSON array: [{"id": string, "score": number 0-100, "reason": string (max 15 words),
 "eligible": "yes"|"no"|"unclear" (can the candidate, living at the location above, legally/practically be hired for this job based on its text?),
 "eligibilityReason": string (max 12 words),
 "aiFriendly": number 0-100 (evidence the company embraces AI/modern tooling: AI products, LLM stack, AI-assisted dev culture)}]
```
Persistence loop: `db.saveMatch(r.id, score, reason, FLASH, clamp(r.aiFriendly))`; if job's current eligibility is "unknown": `eligible==="yes"` → setEligibility("eligible", reason), `"no"` → setEligibility("ineligible", reason), `"unclear"` → leave unknown. NEVER overwrite a rules-engine verdict (rules ran on structured data, trust them more). Tests: stub returns the extended shape; assert aiFriendly + eligibility persisted; assert a job already "ineligible" (set via setEligibility before) is NOT overwritten by `eligible:"yes"`.
- [ ] Full suite green, tsc clean, commit `eligibility at scrape and match time, ai-friendly scoring`.

### Task 9: Surface it (API, board, CLI)

**Files:** Modify: `src/app/api/jobs/route.ts`, `src/app/board.tsx`, `src/app/page.tsx`, `scripts/scrape.ts`

- [ ] **API**: `eligibility` param (comma list, validated against the three values) → filter.
- [ ] **board.tsx**: new filter select `All / Eligible+Unknown (default) / Eligible only / Ineligible`; default state `"eligible,unknown"`; client-side filter respects it (and refresh() keeps no params — filtering stays client-side as today). Card gains a small eligibility badge: green `✓ eligible` (title shows reason), red `✗` for ineligible, neutral `?` for unknown; and an indigo `AI {n}` badge when `aiFriendly != null && aiFriendly >= 60`.
- [ ] **scripts/scrape.ts**: after the per-source lines print `Eligibility: X eligible / Y ineligible / Z unknown` from three `listJobs({eligibility:[...]}).length` calls.
- [ ] tsc + tests green; manual smoke: `pnpm scrape` (live — expect several hundred new jobs from the 4 new sources, with a meaningful eligible count once profile.location is set), dashboard renders badges. Commit `surface eligibility in api, board, cli`.

---

## Self-Review (completed)

- **Spec coverage:** migrations (T2), 4 sources (T4–7), geoRaw on old sources (T7b), rules engine (T3), Gemini eligibility + aiFriendly (T8), default filtering + badges + CLI breakdown (T9). Profile location fields (T2). Phase 1 complete; Today feed/starred/seen UI is Phase 2 (columns land now by design).
- **Placeholder scan:** clean; WWR parser, rules regexes, prompt text all concrete.
- **Type consistency:** `Eligibility`, `MatchResult` v2, `saveMatch(..., aiFriendly?)`, `setEligibility(id, e, reason)`, `classifyGeo(geoRaw, candidateLocation) → {eligibility, reason}` used identically across tasks; `attachDb` introduced in T2 and used only there.
