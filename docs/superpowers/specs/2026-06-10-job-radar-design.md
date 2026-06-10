# job-radar — Design

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan
**Owner:** rxit

## Purpose

A local-first dashboard that aggregates remote job postings from free sources, tracks each
posting through an application pipeline, and uses **Google Gemini** to score every job against
the user's resume/profile. This is a from-scratch rebuild of the Replit "job scraper dashboard"
demonstrated in the reference video (youtube.com/watch?v=RN8R4KJJtFc), built on **Claude Code +
Gemini only** — no Replit, no Anthropic API at runtime.

Primary user: rxit, for their own remote job hunt. Optimize for real usefulness over demo polish.

### Relationship to `remote-hunt`

`~/studio/remote-hunt/` is a separate, existing tool: an application-**tailoring** pipeline that
runs `claude -p` to draft per-job resumes/cover letters. job-radar is the complementary front of
the funnel — **discover → track → match**. They stay decoupled. A future (out-of-scope) bridge
can hand a matched job from job-radar to remote-hunt for tailoring. job-radar does NOT tailor
applications.

## Constraints

- **Runtime AI = Gemini only.** All in-app AI calls go through `@google/genai` using
  `GEMINI_API_KEY` from the environment. Claude Code is the *builder*, not a runtime dependency.
- **Local-first.** No hosted DB, no auth server, no multi-user. Runs on the user's machine.
- **Free sources only** for v1 — no paid job-board APIs, no keys beyond Gemini.
- **Privacy.** The user's resume/profile and the scraped jobs DB are personal data and are
  gitignored. The repo ships code + schema + a profile *template* only.

## Architecture

```
~/studio/code/job-radar/
├── data/                      ← gitignored runtime state
│   ├── jobradar.db            SQLite (jobs, status_history, profile, matches)
│   └── profile.md             user resume text + core skills (from template)
├── templates/
│   └── profile.template.md    committed starter for profile.md
├── scripts/
│   └── scrape.ts              CLI: fetch → normalize → dedupe → store
├── src/
│   ├── lib/
│   │   ├── db.ts              SQLite schema + typed queries (better-sqlite3)
│   │   ├── sources/
│   │   │   ├── index.ts       registry: all JobSource implementations
│   │   │   ├── hn-hiring.ts   HN "Who is Hiring" via Algolia HN API
│   │   │   ├── remoteok.ts    RemoteOK public JSON API
│   │   │   └── hn-jobs.ts     Hacker News jobs (Firebase API)
│   │   ├── normalize.ts       raw → NormalizedJob, stable dedupe key
│   │   └── match.ts           Gemini matcher (flash batch + pro deep-dive)
│   └── app/                   Next.js App Router dashboard
│       ├── page.tsx           board/list view + filters + "Scrape now" / "Match" actions
│       ├── analytics/page.tsx counts per stage, per source, score distribution
│       ├── profile/page.tsx   edit profile.md (resume + skills)
│       └── api/
│           ├── scrape/route.ts   triggers scrape, returns counts
│           ├── match/route.ts    triggers flash batch match
│           ├── match/deep/route.ts  pro deep-match for one job id
│           └── jobs/route.ts     list/update job status (kanban moves)
├── docs/superpowers/specs/    this design + future plans
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### Component contracts (isolated units)

**`JobSource` interface** (`src/lib/sources/`)
- `id: string` (e.g. `"hn-hiring"`)
- `fetch(): Promise<RawJob[]>` — hits one source, returns raw postings. Knows nothing about the
  DB, dedupe, or matching. Each source is independently testable against a recorded fixture.

**`normalize.ts`**
- `normalize(raw: RawJob, sourceId: string): NormalizedJob` — maps any source's shape into the
  canonical row. Produces `dedupeKey` (stable hash of normalized company+title+url) so re-scrapes
  don't create duplicates.

**`db.ts`**
- Owns the SQLite schema and all queries. Exposes typed functions
  (`upsertJobs`, `listJobs(filter)`, `setStatus(id, status)`, `saveMatch(id, score, reason)`,
  `getProfile`, `saveProfile`). No SQL escapes this module.

**`match.ts`**
- `matchNew(): Promise<{scored: number}>` — reads profile + all jobs with no match row, sends
  them to `gemini-2.5-flash` in batches, writes `score (0–100)` + one-line `reason`. Idempotent:
  only scores unscored jobs.
- `deepMatch(jobId): Promise<DeepMatch>` — single job, `gemini-2.5-pro`, returns gap analysis +
  tailoring hints. On-demand only (cost/latency).

**`scripts/scrape.ts`**
- CLI entry (`pnpm scrape`): runs every registered source, normalizes, dedupes, upserts. The
  `/api/scrape` route calls the same underlying function so "Scrape now" in the UI and the CLI
  share one code path.

### Data model (SQLite)

- **jobs** — `id` (uuid), `dedupe_key` (unique), `source`, `company`, `title`, `location`,
  `remote` (bool), `salary` (nullable text), `url`, `description`, `posted_at`, `scraped_at`,
  `status` (default `to_apply`).
- **status_history** — `job_id`, `from_status`, `to_status`, `changed_at`. Audit trail for the
  pipeline; powers analytics.
- **matches** — `job_id` (unique), `score`, `reason`, `model`, `matched_at`.
- **profile** — single row: `resume_text`, `core_skills`, `updated_at`. (File `profile.md` is the
  editable source of truth; DB row is the parsed/cached copy used for matching.)

Pipeline statuses: `to_apply → applied → interviewing → offer`, plus terminal `rejected` /
`archived`. Status changes always append to `status_history`.

## Data flow

1. **Scrape** (CLI or "Scrape now") → each `JobSource.fetch()` → `normalize` → dedupe by
   `dedupe_key` → `upsertJobs`. Returns per-source counts.
2. **Match** ("Match" button or post-scrape) → `matchNew()` reads `profile` + unscored jobs →
   `gemini-2.5-flash` → writes `matches`. Optional per-job **Deep match** → `gemini-2.5-pro`.
3. **Browse** → dashboard lists jobs joined with match score; filter by source / remote /
   min-score / free-text search; sort by score.
4. **Track** → user moves a job's status (kanban); `setStatus` updates `jobs.status` + appends
   `status_history`.
5. **Analyze** → analytics page aggregates `status_history` + `matches` for counts and score
   distribution.

## Error handling

- A failing source (network error, layout change, rate limit) is **isolated**: it logs, returns
  `[]`, and the scrape continues with other sources. The UI reports per-source success/failure
  counts so a silently-empty source is visible, never hidden.
- Gemini errors (quota, transient): matcher retries with backoff per batch; a permanently failing
  batch leaves those jobs unscored (not crashed) and is reported in the result. Missing
  `GEMINI_API_KEY` fails fast with a clear message.
- Dedupe is defensive: re-running scrape is always safe and idempotent.
- DB writes for status changes are transactional (job update + history insert together).

## Testing

- **Unit:** each `JobSource` parsed against a recorded fixture (saved sample API response) — no
  live network in tests. `normalize` dedupe-key stability. `db` query round-trips against an
  in-memory SQLite.
- **Match:** `match.ts` tested with a stubbed Gemini client (injected) so scoring logic, batching,
  and idempotency are verified without API calls.
- **Smoke:** one manual end-to-end (`pnpm scrape` against live sources, then load dashboard) to
  confirm real sources still respond — documented in README, not in CI.

## Privacy / git hygiene

`.gitignore`: `data/`, `profile.md`, `*.db`, `node_modules`, `.next`, `.env*`. Repo ships
`templates/profile.template.md`. Secret scan before first commit per studio rules. Private repo
`rxits/job-radar`, topics `studio` + `code`.

## Out of scope (v1)

Auto-apply / form-filling, browser automation, email or LinkedIn integration, application
*tailoring* (remote-hunt owns that), multi-user / hosted deployment, paid job-board APIs,
scheduled background scraping (v1 is manual "Scrape now").
