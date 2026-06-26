# job-radar SaaS — Master Design

Date: 2026-06-27
Status: approved (architecture); built as sub-projects, S0 first

## Vision

Turn job-radar from a local single-user tool into a **portfolio-grade, publicly
deployed, multi-tenant SaaS**: a public landing page → sign up → a per-user
dashboard where each user brings their own resume and their own Gemini API key
(BYOK) and runs the full scrape → match → kit pipeline against their own,
isolated data. Deployed and working end-to-end. **No billing** in this milestone.

Primary goals (in priority order):
1. **Real & deployed** — works end-to-end for multiple isolated users on a public URL.
2. **Showcase** — demonstrates a complete SaaS build (auth, multi-tenancy, secrets,
   data isolation) for the job hunt / portfolio.
3. **Reuses the craft** — the Flightdeck P1 command-deck design system becomes the
   dashboard skin; none of that work is wasted.

## The core architectural shift: pure logic stays, persistence is rebuilt

The codebase splits cleanly. **All domain logic is pure and storage-agnostic:**
`classify`, `normalize`, `eligibility`, `match` (scoring prompts), `tailor`
(kits), `enrich`, `digest`, the nine source parsers, and the `ui` helpers. Only
**`src/lib/db.ts` and the route handlers** assume a local SQLite file.

Therefore the migration is surgical: **rewrite the persistence layer into an
async, user-scoped Supabase data layer and update the routes; leave the pure
logic untouched.** The bulk of the existing test suite (source parsers, classify,
match, tailor, digest, ui — ~120 tests) stays green unchanged; only the
SQLite-shape tests are replaced with the new data layer's tests.

## Stack

- **Frontend/app:** Next.js 15 App Router + TypeScript + Tailwind v3 + the
  Flightdeck command-deck design system (Geist, framer-motion, lucide, `ui/`
  primitives). Deployed on **Vercel** (free tier).
- **Database:** **Supabase Postgres** with **Row-Level Security** for per-user
  isolation. Replaces `better-sqlite3`.
- **Auth:** **Supabase Auth** (email/password + Google OAuth) via `@supabase/ssr`
  (cookie sessions, App-Router-native).
- **Secrets (BYOK):** each user's Gemini key stored **encrypted in Supabase
  Vault** (pgsodium); decrypted server-side per request. Fallback: app-level
  AES-256-GCM with a server-held key.
- **Runtime AI:** Gemini only, called with the *requesting user's* key.

## Multi-tenancy via Row-Level Security

Every domain table carries a `user_id` (FK to `auth.users`) and an RLS policy
`user_id = auth.uid()`. Isolation is enforced **in Postgres**, so even an
app-layer bug cannot leak one user's data to another. `jobs` uniqueness becomes
`unique(user_id, dedupe_key)`. Server code uses a request-scoped Supabase client
carrying the user's session, so every query runs under that user's RLS context.

## The decoupled pipeline (serverless-safe)

Scraping nine sources plus batched Gemini matching can exceed a Vercel function
timeout. The pipeline is decoupled:

1. **Refresh** runs a fast scrape (fetch + classify + eligibility rules; store raw
   jobs) and inserts a `runs` row.
2. **Matching** processes unscored jobs in **bounded batches per invocation**,
   updating the `runs` row's progress.
3. The dashboard **polls** the run for live progress.
4. A **Vercel Cron** triggers a daily auto-refresh per user.

This also delivers the original Flightdeck "freshness & automation" idea natively.

## Sub-project roadmap

Each sub-project gets its own spec → plan → implementation. Built in dependency
order; S0 first because everything depends on it and it carries the most risk.

| # | Sub-project | Delivers |
|---|---|---|
| **S0** | **Foundation** — Supabase project, schema + RLS + Vault, Supabase Auth, async user-scoped data-layer rewrite, decoupled pipeline | App works multi-user end-to-end (no new product UI) |
| **S1** | **Landing page** — public marketing front door | Discoverable, explains the product |
| **S2** | **Auth + onboarding** — signup → login → first-run wizard (resume + Gemini key) | Real users can get in and set up |
| **S3** | **Dashboard + Settings** — command-deck panel; account/profile/BYOK settings | The product experience |
| **S4** | **More dashboard features** — own brainstorm; re-homes Flightdeck P2–P4 (⌘K, match intelligence, analytics) into the SaaS | 10→100 inside the product |

## What carries over from Flightdeck P1

The shipped design system is the dashboard's visual language: tokens, Geist
fonts, `motion.ts`, the `ui/` primitives (Badge, Button, Card, Meter, Kbd), the
shell/nav pattern, and the reskinned feed. S3 composes these into the
authenticated dashboard; S1's landing page reuses the tokens and type for a
consistent brand.

## Non-goals (YAGNI for this milestone)

- No billing, plans, or payments.
- No teams / organizations / shared workspaces — single-user accounts only.
- No admin panel, no per-user rate limiting beyond what BYOK naturally provides
  (each user spends their own Gemini quota).
- No switch away from Next.js App Router or from Gemini.
- The local SQLite version is not maintained in parallel after S0 merges; S0 is a
  clean cutover (built on a branch, merged once proven).

## Migration & branch strategy

S0 is built on a feature branch (`saas-foundation`). The local SQLite app keeps
working on `main` until the Supabase version is proven, then merges. Secrets
(`SUPABASE_URL`, anon key, service-role key, encryption key) live in env / Vercel
project settings and never in git.
