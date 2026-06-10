# job-radar v2 — Design

**Date:** 2026-06-11
**Status:** Approved (Approach A, user 2026-06-11)
**Supersedes:** parts of `2026-06-10-job-radar-design.md` (v1 remains the foundation)

## Why v2

Three v1 failures observed by the user on real data:
1. **Eligibility** — most of the 438 scraped jobs are not open to a candidate in India. A remote job that is "US only" is noise, not signal.
2. **Comprehensibility** — the 438-card kanban + separate Scrape/Match buttons read as a complex tool, not a guided product.
3. **Outcome gap** — finding jobs isn't the goal; *getting* one is. The product must carry the user from "job found" to "application sent" with everything prepared.

v2 turns job-radar into an open-source, config-driven **remote-job application funnel**: every job is checked for *your* eligibility, ranked for *your* fit, and one click produces the full application kit. Runtime AI stays **Gemini only**.

## Personas / configuration principle

No India-specific hardcoding. The candidate's location, timezone, and preferences live in the profile/settings layer. The repo ships generic; the user's instance is personal. (For the user: Chandigarh, India, IST; roles: engineering/development/operations; bias toward AI-first companies; no salary floor — rank everything.)

## Phase 1 — Eligibility core (the data fix)

### New sources (all free, verified live 2026-06-11, structured geo fields)
- **Remotive** (`remotive.com/api/remote-jobs`) — `candidate_required_location` ("Worldwide", "Canada", …)
- **Jobicy** (`jobicy.com/api/v2/remote-jobs`) — `jobGeo` ("UK", "Anywhere", …)
- **Himalayas** (`himalayas.app/jobs/api`) — `locationRestrictions: string[]` ([] = unrestricted)
- **We Work Remotely** (category RSS feeds) — `region` tag in items where present
Each implements the existing `JobSource` interface with a recorded fixture + parser test, like v1 sources.

### Data model changes (SQLite migrations)
`db.ts` gains a tiny migration runner keyed on `PRAGMA user_version` (existing DBs must upgrade in place; `CREATE TABLE IF NOT EXISTS` cannot add columns).
- `jobs` + `geo_raw TEXT` (the source's eligibility text, null when source has none)
- `jobs` + `eligibility TEXT NOT NULL DEFAULT 'unknown'` CHECK in ('eligible','ineligible','unknown')
- `jobs` + `eligibility_reason TEXT`
- `jobs` + `starred INTEGER NOT NULL DEFAULT 0`
- `jobs` + `seen_at TEXT` (Today-feed bookkeeping, Phase 2)
- `matches` + `ai_friendly INTEGER` (0–100, nullable)
- `profile` + `location TEXT`, `timezone TEXT`, `preferences TEXT` (free-text roles/constraints fed to prompts)
- new `STATUSES` unchanged.
`RawJob` gains `geoRaw: string | null`; `JobRow` gains `geoRaw`, `eligibility`, `eligibilityReason`, `starred`, `aiFriendly`.

### Eligibility engine (`src/lib/eligibility.ts`)
Two stages:
1. **Rules first (free, instant):** classify `geo_raw` against the candidate's location: explicit worldwide markers → eligible; explicit other-region restriction (no candidate-country match) → ineligible; candidate country/region named → eligible; absent/ambiguous → unknown. Pure function, fixture-tested.
2. **Gemini fallback for unknowns:** the existing flash match batch prompt is extended — for each job it now also returns `eligible: "yes"|"no"|"unclear"` + short reason, judged from the description text against the candidate location. `unclear` stays `unknown` (shown, flagged). One combined call per batch: no extra quota cost.
Re-running is idempotent; rules run at scrape-time, Gemini at match-time.

### Matcher changes (`src/lib/match.ts`)
Batch prompt gains candidate location + preferences and returns per job: `score`, `reason`, `eligible`, `eligibilityReason`, `aiFriendly` (0–100: evidence the company embraces AI/modern tooling — AI products, "AI-first", LLM stack mentions, Copilot/Claude/Cursor culture). Persisted via `saveMatch` (extended) + `setEligibility`.

### Default filtering
`listJobs` gains `eligibility` filter; all UI surfaces default to `eligible + unknown`, with ineligible accessible via filter. CLI `pnpm scrape` prints an eligibility breakdown.

## Phase 2 — UX rebuild (the comprehension fix)

### Onboarding (`/setup`)
First run (no profile row) redirects every page to a 3-step wizard: (1) paste resume + core skills, (2) location + timezone + role preferences, (3) "Start the radar" → runs scrape→match chained with a phase progress display, then lands on Today. No more empty dashboard mystery.

### Today feed (`/` becomes the feed)
A ranked list of **eligible, unseen, to_apply** jobs (score desc, then aiFriendly desc): large readable cards — company, title, score + one-line reason, eligibility badge, AI-friendly badge, salary/location when known, link. Three actions per card:
- **Apply** → status `applied`, kicks off the Application Kit (Phase 3), opens it.
- **Skip** → status `archived`, marks seen.
- **Save** → `starred = 1`, marks seen (stays `to_apply`).
Marking seen (`seen_at`) keeps the feed "new items only"; a "Show seen" toggle exists. Feed header: one **Refresh radar** button → `POST /api/refresh` (scrape, then match, single chained run) with per-phase progress + per-source report strip (kept from v1).

### Pipeline (`/pipeline`)
The kanban moves here and shows **only jobs you've acted on** (starred or status ≠ to_apply). Filters stay. The 438-card wall is gone.

### Navigation
`Today · Pipeline · Analytics · Profile`. Analytics keeps v1 sections + eligibility breakdown chart. Profile gains the location/timezone/preferences fields (drives matching + eligibility).

### Design language
Keep the dark theme but make states legible: score and eligibility as colored badges, counts in the nav, empty states with instructions. Liveliness over chrome — instant optimistic actions, subtle transitions (no heavy animation library).

## Phase 3 — Application kit (the outcome fix)

On **Apply** (or via per-job button), `gemini-2.5-pro` generates the kit in one call:
- **Tailored resume** (Markdown) — TRUTHFUL RE-EMPHASIS rules: may reorder, rewrite summary, select projects/bullets, mirror JD terminology for skills genuinely present in the base resume + portfolio dossier facts; may NOT invent employers, dates, skills, metrics, or credentials. Contact block verbatim.
- **Cover letter** (≤250 words, specific to company/JD).
- **Outreach email** (short, for a founder/recruiter DM; drafts only — sending is always manual).
Stored in a new `kits` table (job_id PK, resume_md, cover_md, outreach_md, model, created_at). `/kit/[jobId]` renders all three: resume in a print-styled view (browser print → PDF), copy buttons for each artifact, "Regenerate" button.
**Follow-ups:** jobs `applied` with no status change in 7+ days surface in a "Needs follow-up" strip on Today and a badge in Pipeline.

## Phase 4 — Open source + GitHub presence

- Genericize check: no personal data in repo (already gitignored); seed docs (README with screenshots, setup, architecture; MIT LICENSE; CONTRIBUTING stub).
- Flip `rxits/job-radar` to **public**; add topics (`gemini`, `job-search`, `nextjs`, `open-source`).
- GitHub profile work (separate from the app): update `rxits/rxits` profile README (positioning: AI-native founder-engineer; portfolio links), pin job-radar + best repos, add public showcase READMEs for org-locked flagship work (descriptions only, no client code).

## Error handling / testing
Same disciplines as v1: per-source isolation, fixture-based parser tests, injected Gemini client stubs, migration tests (fresh DB and v1→v2 upgrade), retry/backoff on batches, kit generation failures surfaced with retry. All personal data gitignored.

## Out of scope (v2)
Browser-automation auto-apply (ToS/ban risk), email sending of any kind, LinkedIn scraping, multi-user/hosted mode, paid sources.

## Execution
Four phases = four implementation plans, executed in order; each phase ships working software. Existing pending work (tailoring engine FF-3/FF-4) is folded into Phase 3.
