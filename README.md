# job-radar

Remote job boards are full of roles you cannot legally take. job-radar fixes that: it
scrapes nine free sources, filters to the jobs you are actually eligible for based on
your location, scores every remaining role against your resume with Gemini, and — when
you hit Apply — generates a tailored resume, cover letter, and outreach email (addressed
to the founder/recruiter it finds) ready to send. It ranks high-paying remote roles in
the US / EU / AU to the top and surfaces internships too. All data stays on your machine;
only job text and your resume reach the Gemini API.

Built with Claude Code. Runtime AI is Gemini only.

---

## Features

### Sources & eligibility
- Nine free sources: HN "Who is hiring?" (Algolia), RemoteOK, HN jobs (Firebase),
  Remotive, Jobicy, Himalayas, WeWorkRemotely, **LinkedIn** (public guest search, no
  login), and a **thin X/Twitter** hiring-tweet scrape (best-effort, fails soft).
- Every job is classified at scrape time: `region` (US / EU / AU / worldwide / other),
  `pay_tier` (high / mid / low from salary), and `is_internship`.
- Two-stage eligibility engine: structured geo fields checked with fast rules first;
  free-text descriptions judged by Gemini for anything ambiguous. Results: `eligible`,
  `ineligible`, or `unknown`.
- Today feed defaults to `eligible + unknown`; filter by region, high-pay, or internships;
  ineligible jobs are still accessible via filter.

### Ranking, contacts & tailoring
- High-pay roles float to the top; the matcher is told to rank remote roles paying in
  USD/EUR/AUD and open to India/worldwide highest.
- `pnpm import-resume` seeds your profile from a master `RESUME.md`.
- After matching, kits are auto-generated for the top eligible matches, each with a
  heuristic **contact lookup** (founder/recruiter + best-guess email) wired into the
  outreach email. The contact panel also lives on each `/kit/[jobId]` page.

### AI matching
- `gemini-2.5-flash` scores every eligible job 0–100 against your resume, writes a
  one-line reason, and rates AI-friendliness (evidence the company embraces LLMs /
  modern tooling).
- Batched per-source; re-running is idempotent.

### Today feed & pipeline
- **Today** (`/`): ranked, unseen, to-apply jobs. Three actions per card: Apply, Skip,
  Save.
- **Apply** kicks off the Application Kit and marks the job applied.
- **Pipeline** (`/pipeline`): kanban of jobs you have acted on — To Apply → Applied →
  Interviewing → Offer, plus Rejected and Archived.
- Follow-up strip: applied jobs with no status change in 7+ days surface on Today and
  badge in Pipeline.

### Application kit
- One click from any job → `gemini-2.5-pro` generates in a single call:
  - **Tailored resume** (Markdown, print to PDF): reorders and mirrors JD terminology
    for skills genuinely present in your base resume. Cannot invent employers, dates,
    skills, metrics, or credentials.
  - **Cover letter** (≤250 words, specific to company/JD).
  - **Outreach email** (short founder/recruiter DM — drafts only, never auto-sent).
- Stored locally in the `kits` SQLite table. Copy buttons and a Regenerate button on
  `/kit/[jobId]`.

---

## Quick start

```bash
pnpm install
export GEMINI_API_KEY=your_key_here
pnpm dev          # opens http://localhost:3000 → redirects to /setup on first run
```

The `/setup` wizard walks you through three steps:

1. Paste your resume text and core skills.
2. Enter your location and timezone (drives eligibility rules).
3. Hit **Start the radar** — scrapes all sources, checks eligibility, scores matches.

---

## CLI commands

```bash
pnpm import-resume [path]   # seed your profile from a master RESUME.md
pnpm scrape   # fetch from all sources, classify + run eligibility rules, per-source report
pnpm match    # score unscored eligible/unknown jobs with Gemini; auto-tailor top matches
pnpm dev      # Next.js dev server at http://localhost:3000
pnpm build    # production build
pnpm test     # vitest unit suite (108 tests, no live network)
pnpm exec tsc --noEmit   # typecheck
```

---

## How it works

```
sources (7)
    │  fetch()
    ▼
normalize / deduplicate
    │  upsertJobs()
    ▼
SQLite  data/jobradar.db
    │
    ├─ rules engine (fast, free)
    │       classifyGeo(geoRaw, candidateLocation)
    │       → eligible / ineligible / unknown
    │
    ├─ Gemini flash batch
    │       score + reason + eligibility + aiFriendly
    │       per job, per batch
    │
    ▼
ranked Today feed  (eligible + unknown, unseen, to_apply)
    │  Apply
    ▼
Application kit  (gemini-2.5-pro)
    resume_md + cover_md + outreach_md  →  /kit/[jobId]
```

---

## Adding a source

1. Create `src/lib/sources/mysource.ts` implementing the `JobSource` interface:

```typescript
import type { JobSource, RawJob } from "../types";

export const mySource: JobSource = {
  id: "mysource",
  async fetch(): Promise<RawJob[]> {
    const res = await fetch("https://example.com/api/jobs");
    if (!res.ok) throw new Error(`mysource ${res.status}`);
    const data = await res.json();
    return data.jobs.map((j: any): RawJob => ({
      company: j.company,
      title: j.title,
      location: j.location ?? null,
      remote: true,
      salary: null,
      url: j.url,
      description: j.description?.slice(0, 4000) ?? "",
      postedAt: null,
      geoRaw: j.location_restriction ?? null,  // eligibility field; null = unknown
    }));
  },
};
```

2. Record a real API response as a fixture in `test/fixtures/mysource.json`.
3. Write a parser test in `src/lib/sources/mysource.test.ts` that imports the fixture
   (no live network — see existing tests for the pattern).
4. Register in `src/lib/sources/index.ts`:

```typescript
import { mySource } from "./mysource";
export const sources: JobSource[] = [...existingSources, mySource];
```

Sources with a structured geo field (like Himalayas `locationRestrictions` or Remotive
`candidate_required_location`) feed the rules engine automatically. Sources without one
fall back to Gemini judgment.

---

## Configuration & privacy

All personal data (resume, location, preferences) lives in `/setup` and is stored in
`data/jobradar.db`, which is gitignored. It never leaves your machine except as part of
Gemini API calls (job text + your resume, no account info).

The eligibility engine is fully generic — set your location to anything in `/setup` or
`/profile` and the rules and Gemini judgment adapt. No location is hardcoded in the
application code.

Required env var:

```
GEMINI_API_KEY=   # from https://aistudio.google.com/
```

No other external services, no auth, no accounts.

---

## Tests

```bash
pnpm test
```

108 tests covering:

- Per-source fixture parsers (no live network)
- Eligibility rules engine
- DB migration (fresh schema and v1→v2 upgrade path)
- Scrape pipeline with injected source stubs
- Match pipeline with injected Gemini client stubs
- Application kit generation with injected Gemini stub

---

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
