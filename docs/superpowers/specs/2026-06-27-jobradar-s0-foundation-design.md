# job-radar SaaS — S0 Foundation Design

Date: 2026-06-27
Status: approved (design)
Parent: `2026-06-27-jobradar-saas-master-design.md`
Branch: `saas-foundation`

## Goal

Replace the local single-user SQLite layer with a **multi-tenant Supabase
foundation**: Postgres schema with Row-Level Security, Supabase Auth, an async
user-scoped data layer, encrypted BYOK Gemini keys, and a serverless-safe
pipeline. **No new product UI** — when S0 is done, the existing pages work
against Supabase for a logged-in user, with every row isolated per user.

S0 is intentionally scoped to the *foundation*. Landing, onboarding polish, and
new dashboard features are S1–S4.

## Environment & Supabase project

- A Supabase project (free tier). Env vars (in `.env.local`, Vercel project
  settings — never committed):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + server)
  - `SUPABASE_SERVICE_ROLE_KEY` (server only — used solely by the cron job and
    admin-less server tasks that must bypass RLS deliberately)
  - `APP_ENCRYPTION_KEY` (only if the Vault fallback path is used)
- Local development uses the **Supabase CLI** (`supabase start`) to run Postgres +
  Auth locally, so data-layer tests run against a real Postgres with the real
  schema and RLS — no live cloud needed for tests.
- SQL schema and RLS live in **versioned migration files** under
  `supabase/migrations/` (the Supabase CLI convention), not inline strings.

## Schema (Postgres) + RLS

All domain tables gain `user_id uuid not null references auth.users(id)` and an
RLS policy. Mapping from the current SQLite tables:

| Table | Notes vs. current SQLite |
|---|---|
| `profiles` | One row **per user** (was a single `id=1` row). `user_id` PK = `auth.uid()`. Columns: resume_text, core_skills, location, timezone, preferences, updated_at. |
| `jobs` | `+ user_id`. Uniqueness becomes `unique(user_id, dedupe_key)`. All existing columns kept (region, pay_tier, is_internship, eligibility, status, starred, seen_at, …). |
| `matches` | `+ user_id`; PK stays `job_id` (job_id already unique per user). score, reason, model, ai_friendly, matched_at. |
| `contacts` | `+ user_id`. |
| `kits` | `+ user_id`. |
| `tailored` | `+ user_id`. |
| `status_history` | `+ user_id`. |
| `runs` | **New.** Tracks pipeline progress: id, user_id, kind (`scrape`/`match`/`refresh`), status (`running`/`done`/`error`), totals (fetched, inserted, scored, failed), per-source JSON report, started_at, finished_at, error. |
| `user_secrets` (or Vault) | **New.** Holds the encrypted Gemini key per user (see BYOK below). |

**RLS:** each domain table gets `enable row level security` plus policies
`using (user_id = auth.uid())` for select/insert/update/delete. A profile row is
auto-created on signup via a Postgres trigger on `auth.users`.

**Indexes:** `jobs(user_id, status)`, `jobs(user_id, eligibility)`,
`matches(user_id)`, and the `unique(user_id, dedupe_key)` constraint.

## BYOK Gemini keys

- **Primary:** Supabase **Vault** (pgsodium). Settings writes the key via a
  `SECURITY DEFINER` RPC that stores it in Vault keyed by `user_id`; a second
  `SECURITY DEFINER` RPC returns the decrypted key **server-side only** (never
  exposed to the browser; the client only ever sees "key set / not set").
- **Fallback:** a `user_secrets` table storing AES-256-GCM ciphertext encrypted
  with `APP_ENCRYPTION_KEY`, decrypted in a server-only module.
- The match/kit/contact pipeline reads the requesting user's key server-side and
  constructs the Gemini client with it. If a user has no key set, pipeline
  endpoints return a clear "add your Gemini key in Settings" error (no crash).

## Auth (`@supabase/ssr`)

- Three client factories: a **browser client**, a **server client** (reads/writes
  the session cookie in Server Components / Route Handlers), and a **service-role
  client** (cron only).
- **Middleware** refreshes the session cookie on each request and **protects** the
  app routes: unauthenticated requests to dashboard routes redirect to `/login`;
  `/api/*` returns 401.
- Auth methods: email/password and Google OAuth. (Login/signup *screens* are
  minimal in S0 — full onboarding is S2 — but functional enough to create a user
  and reach the dashboard.)

## Data-layer rewrite

- `src/lib/db.ts` is replaced by an **async, user-scoped data layer** exposing the
  same conceptual operations the routes already call, now `Promise`-returning and
  implemented with the request-scoped Supabase server client (so RLS applies):
  `upsertJobs, listJobs, unscoredJobs, getJob, setStatus, markSeen, setStarred,
  needsFollowUp, saveMatch, setEligibility, statusHistory, recentActivity,
  getProfile, saveProfile, saveTailored, getTailored, saveKit, getKit,
  saveContact, getContact`.
- The `Db` interface becomes async; the pure modules that *consume* a `Db`
  (`scrape.ts`, `match.ts`, `tailor.ts`) change only where they `await` it — their
  logic and prompts are unchanged.
- Route handlers obtain the data layer from the authenticated request context
  (user id from the session) instead of `createDb()`.
- `server-db.ts` (the singleton) is removed in favor of per-request clients.

## Pipeline cutover (serverless-safe)

- `POST /api/refresh` → runs the fast scrape for the current user, writes jobs,
  creates a `runs` row (kind=`refresh`), then returns immediately with the run id.
- `POST /api/match` (or a `runs`-driven endpoint) → scores the next bounded batch
  of unscored jobs for the user, updates the run's progress; the client polls
  `GET /api/runs/:id` until `done`.
- `GET /api/runs/:id` → run status/progress for the polling UI.
- **Vercel Cron** (`/api/cron/refresh`, service-role client) → iterates users with
  a key set and a daily-refresh preference, running scrape + a match batch.

## Testing strategy

- **Untouched (stay green):** all source-parser tests, `classify`, `eligibility`
  (pure parts), `match` (with injected Gemini stub), `tailor`, `enrich`, `digest`,
  `ui`. These never touched storage.
- **Rewritten:** `db.test.ts` → a data-layer test suite running against a local
  Supabase Postgres (`supabase start`) with the real migrations applied; seeds two
  users and asserts **RLS isolation** (user A cannot read user B's jobs) plus core
  CRUD round-trips.
- **Adapted:** `scrape.test.ts` / `match.test.ts` stubs become async to match the
  new `Db` interface.
- New: a BYOK round-trip test (store → server-side retrieve → never leaks to a
  client-shaped response).
- Gate per task: `pnpm test` green and `tsc --noEmit` clean.

## Deployment

- Vercel project linked to the repo; env vars set in Vercel.
- Supabase migrations applied to the cloud project (`supabase db push`).
- Vercel Cron configured for the daily refresh endpoint.

## Sequencing within S0 (for the plan)

1. Supabase project + CLI + migrations: schema, RLS, triggers, indexes.
2. Auth: `@supabase/ssr` clients + middleware + minimal login.
3. Async data layer + adapt `scrape`/`match`/`tailor` call sites.
4. BYOK Vault RPCs + server key retrieval + Settings write endpoint.
5. Decoupled pipeline: `runs` table usage, batched match, polling endpoint, cron.
6. Port the existing pages/routes to the authenticated, async data layer.
7. Data-layer + RLS + BYOK tests; deploy.

## Non-goals for S0

- No landing page (S1), no polished onboarding wizard (S2), no new dashboard
  features (S4). Login/signup screens are functional-minimal only.
- No data migration from the old local SQLite DB — S0 starts users fresh.
