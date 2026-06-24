# job-radar v3 — wider sourcing, contacts, region/pay focus, best-match auto-tailoring

Date: 2026-06-24
Status: approved (brainstorming)
Builds on: v2 (`2026-06-11-job-radar-v2-design.md`). Repo: `rxits/job-radar` (existing, in-place changes — not a rebuild).

## Goal

rxit is in India and wants high-paying **remote** roles (and internships) that pay in USD/EUR/AUD — primarily US / Europe / Australia companies that hire India-remote or worldwide. job-radar must:

1. Pull the latest jobs from **all current sources + LinkedIn + X/Twitter**.
2. Detect and surface **internships** alongside full roles.
3. Rank **high-pay, target-region, India-remote-eligible** roles to the top.
4. For the best matches, produce a **tailored resume** (extends existing kit generator) seeded from the real master resume.
5. Surface the **person to contact** (founder / recruiter / hiring manager) with a best-guess email.

## Non-goals

- No paid APIs. X has no free API; we do a thin best-effort scrape only.
- No logged-in LinkedIn automation in this version (guest endpoint only — zero account risk). A logged-in `/browse` mode is explicitly deferred.
- No auto-sending of applications/emails. Output is drafted + copyable; rxit sends manually.

## Architecture (extends existing pluggable design)

Data flow:
`scrape (9 sources)` → `normalize (+isInternship, +payTier, +region)` → `eligibility` → `match (region/pay-aware Gemini)` → `enrich top matches (contacts)` → `kit (tailored resume + outreach to named contact)` → `feed/board (region · pay · internship filters)`

All SQL stays in `src/lib/db.ts`. Sources implement `JobSource` in `src/lib/sources/` and register in `sources/index.ts`. No live network in tests — every parser/enricher is tested against saved fixtures in `test/fixtures/`.

## Phase 1 — Sources + classification + ranking + filters

### 1a. LinkedIn source (`src/lib/sources/linkedin.ts`)
- Free guest endpoint: `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` with params `keywords`, `location`, `f_WT=2` (remote), `start` (paging by 25).
- Loop a small config of keyword × location queries (e.g. `AI engineer`, `ML engineer`, `full stack` × `United States`, `European Union`, `Worldwide`). Cap total pages to stay polite; small delay between requests; `User-Agent` set.
- Parse returned HTML job cards (`<li>` → title, company, location, job link, posted date). Optional per-job detail fetch (`jobs-guest/jobs/api/jobPosting/{id}`) for description, behind a small cap.
- `geoRaw` = card location string; `remote = true` (we only query remote). Fragile-by-design — parser isolated and fixture-tested so breakage is loud and localized.

### 1b. X/Twitter source (`src/lib/sources/twitter.ts`)
- Thin best-effort. No auth, no paid API. Pull a curated list of hiring accounts via the public `https://syndication.twitter.com/srv/timeline-profile/screen-name/<handle>` JSON timeline.
- Regex-filter tweets for hiring signals (`hiring`, `we're hiring`, `remote`, `apply`) and extract the outbound link as the job `url`. Low-confidence; documented as fragile; account list in a small config constant.
- If the endpoint is unavailable, the source fails soft (returns `[]`, logs a warning) — never breaks a scrape run.

### 1c. Internship detection (`src/lib/normalize.ts`)
- `detectInternship(title, description): boolean` — regex (`intern`, `internship`, `co-op`, `summer 20xx`), guarding false positives (`internal`, `international`).
- Stored as `is_internship` (migration v4). Surfaced, never auto-filtered.

### 1d. Pay tier + region tags (`src/lib/normalize.ts` or new `src/lib/classify.ts`)
- `payTier(salary): "high" | "mid" | "low" | "unknown"` — parse `$`/`€`/`£`/`₹` ranges, annualize, band on USD-equivalent (high ≈ ≥ $100k). Hourly/monthly normalized.
- `regionOf(location, geoRaw): "us" | "eu" | "au" | "worldwide" | "other" | "unknown"`.
- Both stored on the job row (`pay_tier`, `region`) at scrape/normalize time; cheap, deterministic, fixture-tested.

### 1e. Ranking
- `eligibility.ts` + match prompt updated so **USD/EUR/AUD-paying, India-remote-eligible, target-region** roles rank highest; high `payTier` boosts the surfaced score ordering. Internships ranked within their own lane (not penalized).
- Feed sort already uses score→aiFriendly; add a tiebreak/boost for `payTier === "high"`.

### 1f. UI (feed + board)
- Region chips (US / EU / AU / WW), a High-pay toggle, an Internships toggle. Filters operate on the new columns. Badges on cards for region + internship + pay tier.

### Migration v4 (`src/lib/db.ts`, `USER_VERSION = 4`)
- `addCol("jobs", "is_internship INTEGER NOT NULL DEFAULT 0")`
- `addCol("jobs", "pay_tier TEXT")`
- `addCol("jobs", "region TEXT")`
- new `contacts` table (defined here, populated in Phase 2):
  `CREATE TABLE IF NOT EXISTS contacts (job_id TEXT PRIMARY KEY, company TEXT, person_name TEXT, person_title TEXT, emails TEXT, links TEXT, source TEXT, confidence TEXT, model TEXT, created_at TEXT)`
- `SELECT`, `toRow`, and `insert`/upsert extended for the new job columns.

## Phase 2 — Contact enrichment (`src/lib/enrich.ts`, `contacts` table)

`enrichContact(job): Contact` —
1. Derive company domain: prefer the job `url` host if it's the company's own site; else heuristically build candidates from the company name and verify by fetching.
2. Best-effort fetch `/`, `/about`, `/team`, `/careers`, `/contact` (short timeout, fail soft).
3. Gemini (flash, single call) extracts the best contact person (founder / recruiter / hiring manager), title, any literal emails, and LinkedIn URLs found in the fetched text.
4. Generate likely email patterns from domain + person name (`first@`, `first.last@`, `firstlast@`), tagged as guesses vs. found.
5. Store keyed by `job_id`; `confidence` reflects found-vs-guessed.

Runs lazily via a per-job button **and** auto for top-scored jobs after a match run (small cap to avoid hammering). Shown as a Contact panel on the kit page (`/kit/[jobId]`) with copy buttons. Pure heuristic functions (domain guessing, email patterns) are unit-tested; network fetch + Gemini are mocked.

API: `POST /api/contact` `{ jobId }` → enrich + persist + return.

## Phase 3 — Best-match auto-tailoring (extends kit generator)

- `import-resume` helper (`scripts/import-resume.ts`, `pnpm import-resume`): reads `~/studio/resumes/general/RESUME.md` (path overridable via arg/env) and seeds the `profile` row so the kit generator tailors from the real master resume instead of placeholder text.
- After a match run, **auto-generate kits for the top-N eligible, high-score jobs** (N small, configurable). Existing `generateKit` reused.
- Outreach in the kit now addresses the **enriched named contact** (greeting by name, using the best-guess email + subject) when a contact exists; falls back to the current generic outreach otherwise.
- Truthful-re-emphasis rules from v2 kit generation preserved — no fabricated experience.

## Testing & quality

- Fixture-based parser tests: `linkedin.test.ts`, `twitter.test.ts` (saved HTML/JSON in `test/fixtures/`).
- `normalize`/`classify` tests: internship detection (incl. false-positive guards), pay-tier banding, region tagging.
- `enrich` tests: domain-candidate generation, email-pattern generation, Gemini-extraction parsing (mocked).
- Migration test: v3→v4 upgrade adds columns + `contacts` without data loss.
- `pnpm test` green, `pnpm exec tsc --noEmit` clean before each commit. Maintain the existing no-live-network rule.

## Commit plan (incremental, on `main`)

Per `~/.claude/CLAUDE.md` GitHub rules: commit at each meaningful working state — (1) migration v4 + classify, (2) LinkedIn source, (3) X source, (4) UI filters, (5) enrich layer + API + panel, (6) import-resume + auto-tailor. Push at end of session. `data/` stays gitignored (personal DB/profile never committed).
