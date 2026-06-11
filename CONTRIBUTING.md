# Contributing

## Setup

```bash
pnpm install
export GEMINI_API_KEY=your_key_here
pnpm dev
```

Typecheck: `pnpm exec tsc --noEmit`

## Testing expectations

- Every new `JobSource` needs a recorded fixture in `test/fixtures/` and a parser test
  in `src/lib/sources/mysource.test.ts`. No live network in tests — fetch is never
  called from a test file.
- Changes to the Gemini prompt or eligibility logic need tests that inject a stub
  client. See `src/lib/match.test.ts` and `src/lib/tailor.test.ts` for the pattern.
- New DB columns need a migration test covering both a fresh DB and an upgrade from the
  previous schema. See `src/lib/db.test.ts`.

Gate before opening a PR:

```bash
pnpm test && pnpm exec tsc --noEmit
```

Both must pass with zero errors.

## Commit style

Lowercase imperative subject line, no trailing period, no emojis.

```
add jobicy source with fixture test
fix eligibility rule for EMEA multi-region strings
update match prompt to include aiFriendly score
```

## What is especially welcome

- New `JobSource` implementations (see README for the interface and fixture pattern).
  Preference for sources that expose a structured geo/eligibility field.
- Improvements to the eligibility rules engine (`src/lib/eligibility.ts`).
- Expanded region coverage in the rules (more country/region tokens).
- Bug reports with a failing test that reproduces the issue.

## Out of scope

Browser-automation auto-apply, email sending, LinkedIn scraping, multi-user or hosted
mode, paid job board integrations.
