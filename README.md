# job-radar

Local remote-job radar: scrape free sources → track applications → match against your resume with Google Gemini. Built with Claude Code; runtime AI is Gemini only.

## Setup

```bash
pnpm install
export GEMINI_API_KEY=...      # required for matching
```

## Use

```bash
pnpm scrape     # fetch jobs from HN Who-is-hiring, RemoteOK, HN jobs → data/jobradar.db
pnpm match      # score unscored jobs with gemini-2.5-flash (set your profile first)
pnpm dev        # dashboard at http://localhost:3000
pnpm test       # run unit tests
```

In the dashboard: **Scrape now** and **Match (Gemini)** buttons, source/remote/score/search filters, a six-column tracker (To Apply → Applied → Interviewing → Offer, plus Rejected and Archived), `/analytics`, and `/profile` (paste resume + core skills there before matching — see `templates/profile.template.md`).

## Sources

HN "Who is hiring?" (Algolia API), RemoteOK (`/api`), HN jobs feed (Firebase). Add a source by implementing `JobSource` in `src/lib/sources/` and registering it in `src/lib/sources/index.ts`.

## Privacy

`data/` (jobs DB + profile) is gitignored. Nothing leaves your machine except job text + your resume sent to the Gemini API for scoring.
