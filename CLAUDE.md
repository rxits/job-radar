# job-radar

Local remote-job radar: scrape free sources → track in a kanban → score against my resume with Gemini.

- Stack: Next.js 15 (App Router) + TypeScript + Tailwind v3 + better-sqlite3 + @google/genai (2.x).
- Runtime AI is **Gemini only** (`GEMINI_API_KEY` from env); models: gemini-2.5-flash (batch match), gemini-2.5-pro (deep match).
- `data/` (SQLite DB + profile) is gitignored — personal data never committed.
- All SQL lives in `src/lib/db.ts`. Sources implement `JobSource` in `src/lib/sources/` and register in `sources/index.ts`. Nine sources incl. LinkedIn (guest search) + thin X/Twitter. Jobs are classified at scrape time in `src/lib/classify.ts` (region/pay_tier/is_internship). Contact enrichment in `src/lib/enrich.ts`. Migration `user_version` = 4.
- Tests: `pnpm test` (vitest, fixtures in `test/fixtures/`, no live network in tests). Typecheck: `pnpm exec tsc --noEmit`. NOTE: `pnpm` may want a reinstall in CI; run `./node_modules/.bin/vitest run` / `./node_modules/.bin/tsc --noEmit` directly.
- CLI: `pnpm import-resume`, `pnpm scrape`, `pnpm match`. Dashboard: `pnpm dev` → localhost:3000.
- Design spec: `docs/superpowers/specs/2026-06-10-job-radar-design.md`. Sibling project `~/studio/remote-hunt` handles application *tailoring* — keep them decoupled.
