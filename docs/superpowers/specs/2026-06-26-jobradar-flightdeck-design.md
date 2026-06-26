# job-radar — "Flightdeck" milestone (10 → 100)

Date: 2026-06-26
Status: approved (design); implementation phased

## Goal

Take job-radar's surface from a competent-but-utilitarian internal dev tool to a
genuinely **premium product** — without weakening the strong backend (9 sources,
eligibility engine, Gemini scoring, kits, kanban). One milestone, three goals held
simultaneously:

1. **Daily cockpit** — fast, dense, keyboard-driven (Linear/Raycast-grade).
2. **Portfolio showpiece** — screenshot-worthy, clearly premium in 30 seconds.
3. **Ergonomic** — gets out of the way; interactions feel instant.

The chosen aesthetic — **Precision dark · "command deck"** — is the one visual
language that serves all three at once.

## Design language: Precision dark · command deck

- **Canvas** near-black `#0A0A0B`. **Surfaces** raised ~3% lightness with a single
  1px hairline border. Depth comes from layering + borders, **not** heavy drop
  shadows.
- **One accent: warm amber/gold.** Used sparingly — primary action, focus rings,
  active state, the peak of a score meter. Everything else rides a 12-step neutral
  ramp. (Superhuman-style; distinctive against near-black, avoids "startup blue".)
- **Kill the tag soup.** Today's UI renders every signal as a tiny colored emoji
  pill. Replace with a quiet, consistent badge system: monochrome by default, color
  only when it *means* something (score tier, eligibility). Score becomes a small
  inline **meter**, not a pill.
- **Typography.** Geist Sans for UI (13–14px, tight tracking on headings); **Geist
  Mono for every number / score / data value** — the single highest-leverage move
  for an instant premium read. Self-hosted via `next/font` (zero layout shift, zero
  external request). Real hierarchy, not uniform `text-sm`.
- **Motion.** 150–220ms `ease-out` baseline. Cards stagger-in on load; the job
  drawer slides; triaged cards animate out on action; the command palette springs
  in. Tasteful, never bouncy. All motion gated by `prefers-reduced-motion`.

## Architecture re-plan

Current state: presentation logic is inline Tailwind inside `feed.tsx` / `board.tsx`
with no shared primitives. We introduce real layers (no change to the data contract
in `db.ts` beyond additive columns):

```
src/
  components/
    ui/         design-system primitives — dumb, reusable, no business logic:
                Button, Badge, Card, Drawer, Kbd, Tooltip, Stat, Meter,
                Skeleton, Sparkline
    feature/    compose primitives + data: JobCard, JobDrawer, CommandPalette,
                TriageDeck, MatchBreakdown, FunnelChart, SourceROI, NewSinceVisit
  lib/
    motion.ts   single source of truth for Framer variants (timing/easing)
    queries/    new read models: funnel(), sourceROI(), velocity(), clusters()
    db.ts       unchanged contract; additive: last_visited_at, structured match subscores
```

**Stack additions** (all light, self-hosted, tree-shaken):

- `framer-motion` — compositor-only props (transform/opacity), reduced-motion gated.
- `cmdk` — headless command-palette primitive (⌘K), Raycast/Linear-grade.
- `lucide-react` — consistent icon set.
- `geist` — Sans + Mono via `next/font`.
- **Charts: hand-rolled SVG** (funnel, bars, sparklines). No chart library — zero
  bundle bloat, full control, on-brand. (Same approach proven in skillmap.)

**Performance contract:**

- Server components for first paint; `Suspense` + skeleton fallbacks.
- Interactions optimistic and < 100ms; no spinner for local state changes.
- Animations 60fps, compositor-only; never animate layout-affecting props.
- Fonts self-hosted (no CLS, no network). Nav links prefetched.
- Net new bundle stays small — cmdk, framer, lucide are each tiny and tree-shaken.

## Feature bundles

### 1. Triage & navigation

- **⌘K command palette** (`cmdk`): jump to any view, fuzzy-search jobs by
  company/title, run actions (Apply / Skip / Save / Refresh / open Pipeline).
- **Keyboard triage**: `j`/`k` move selection, `a` apply, `s` skip, `f` save,
  `↵` open drawer, `⌘K` palette, `?` shortcut cheatsheet.
- **JobDrawer** — a slide-over panel showing the full JD, the enriched contact, the
  generated kit (or a generate button), and the match breakdown in one place.
  Replaces the cramped, do-everything card.

### 2. Match intelligence

- `match.ts` extends its Gemini output to emit **structured subscores**
  (skills / seniority / domain-fit / AI-fit) plus a short list of **gaps**
  ("they want Kubernetes; your resume is thin on it"). Stored alongside the existing
  0–100 score (additive `matches` columns or a JSON blob; the overall score and the
  one-line reason are preserved for backward compatibility).
- Rendered in the drawer as **skill-match bars + a gaps list** — turning the opaque
  0–100 into a trustworthy, premium graphic.

### 3. Analytics & funnel

- New read models in `lib/queries/`: pipeline **funnel**
  (scraped → eligible → applied → interview → offer), **source ROI** (which boards
  actually convert), **application velocity** (apps/week), **response-rate trend**.
- Rendered with hand-rolled SVG: a funnel, ranked source bars, a velocity sparkline.
  The big-graphics editorial moment — and genuinely useful.

### 4. Freshness & automation

- **Auto daily scrape+match**: a `scripts/refresh.ts` entry + documented system-cron
  recipe so the radar stays fresh without the manual "Refresh radar" button.
- **"New since last visit"**: store `last_visited_at`; surface a count + a filtered
  view of jobs scraped since then.
- **Cross-source dedup**: the same role posted on RemoteOK + WWR + LinkedIn collapses
  to **one card with multiple source links**. Done at query/render time via a fuzzy
  cluster key (normalized company+title) — **no data loss**, storage `dedupe_key`
  unchanged.

## Phased roadmap (each phase independently shippable)

| Phase | Delivers | Score |
|------|----------|-------|
| **P1 — Foundation & reskin** | Design tokens, Geist fonts, `motion.ts`, `ui/` primitives, new app shell/nav, reskinned Today feed + JobCard. No behavior change. | 10 → ~55 |
| **P2 — Triage & navigation** | ⌘K palette, keyboard triage, JobDrawer | ~70 |
| **P3 — Match intelligence** | Structured subscores + breakdown UI | ~80 |
| **P4 — Analytics & funnel** | Dashboard + SVG charts + read models | ~90 |
| **P5 — Freshness & automation** | Scheduler, new-since-visit, cross-source dedup | 100 |

The full milestone is too large for a single implementation plan. This spec captures
the whole arc; **each phase gets its own plan and ships on its own.** P1 is the
foundation everything else composes on, so it is built first — and on its own it makes
the app read as a different product.

## Testing & quality

- Pure logic (cluster keys, funnel/velocity math, subscore parsing) lives in
  `lib/` and is unit-tested with vitest fixtures — no live network, matching the
  existing 143-test discipline.
- UI primitives stay dumb and prop-driven so they're trivially reasoned about.
- Each phase keeps `pnpm test` green and `tsc --noEmit` clean before it lands.
- Personal data stays local; `data/` remains gitignored. Runtime AI stays Gemini-only.

## Non-goals (YAGNI for this milestone)

- No multi-user / auth / hosting — it remains a local single-user tool.
- No switch away from SQLite or Next.js App Router.
- No light theme (dark is the product); a theme toggle is out of scope.
- No mobile-first redesign; responsive-down is nice-to-have, desktop is the target.
