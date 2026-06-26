# Changelog

## Unreleased

### Added
- **`pnpm digest [limit]`** — a daily terminal briefing of the top eligible, scored, to-apply matches (score, region/pay/AI-friendly tags, one-line reason, enriched contact, apply URL, kit-ready flag) plus a stale follow-up section. The render lives in `src/lib/digest.ts` and is pure (no DB/network/clock), so it is unit-tested deterministically; the script saves each run to `data/digests/<date>.md` (gitignored).

## v3 — 2026-06-24

Wider sourcing, region/pay focus, contacts, and best-match auto-tailoring.

### Added
- **LinkedIn source** — public guest job-search endpoint (`jobs-guest/jobs/api/seeMoreJobPostings/search`, remote-only), no login, fixture-tested parser.
- **X/Twitter source** — thin best-effort scrape of the public syndication timeline for curated hiring accounts; fails soft, never blocks a scrape run.
- **Classification at scrape time** (`src/lib/classify.ts`): `region` (us/eu/au/worldwide/other), `pay_tier` (high/mid/low, FX-normalized), and `is_internship` — with a one-time backfill of existing rows.
- **Region / high-pay / internship filters and badges** on the Today feed and pipeline board.
- **Contact enrichment** (`src/lib/enrich.ts` + `contacts` table): derives company domain, fetches about/team/careers pages, extracts the founder/recruiter via Gemini, and generates best-guess email patterns. Surfaced as a Contact panel on `/kit/[jobId]` (`POST /api/contact`).
- **`pnpm import-resume`** — seeds the profile from a master `RESUME.md`.
- **Auto-tailoring** — `pnpm match` now auto-generates application kits for the top-N eligible matches, with the outreach email addressed to the enriched contact.

### Changed
- Matcher ranks remote roles paying in USD/EUR/AUD and open to India/worldwide highest; high-pay roles float to the top of every listing.
- Migration `user_version` bumped to 4.

### Fixed
- Himalayas source: the bulk listing API now redacts `companyName` to the literal `"name"`; fall back to a prettified `companySlug`.
