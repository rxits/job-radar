# job-radar — "Warm & Encouraging" redesign

Date: 2026-06-28
Status: approved (direction); re-skin of the existing design system

## Why

The Flightdeck "command deck" aesthetic (near-black canvas, mono on every number,
Linear/Raycast DNA) reads as a **developer tool**. job-radar is for *everyone* —
nurses, teachers, marketers, designers, every domain. The surface must feel warm,
human, approachable, and reassuring (job hunting is stressful), and people across
all backgrounds should *love* what they see.

## Direction (decided)

- **Light-first**, warm. Default theme is a warm cream canvas; a **dark mode** is
  available via a toggle, persisted per user.
- **Personality: warm & encouraging** — supportive, human, "we've got your back."
- **Primary accent: warm coral / terracotta** (`#F2603C`), with a hopeful green for
  positive/score states and soft amber as a warm highlight.
- **Soft & rounded**: white cards with gentle shadows (not hairline borders), larger
  corner radii, airier spacing, bigger touch targets.
- **Friendly type**: drop mono-as-decoration entirely; warm, readable sans with
  generous sizing. (Geist Sans retained as the self-hosted base; warmth comes from
  color/shape/space/copy, not a terminal typeface.)
- **Plain, encouraging copy** — zero jargon; speaks to a non-technical reader.

## How (architecture — it's a re-skin, not a rebuild)

The semantic token layer makes this clean:

1. **Tokens** (`globals.css`): redefine the CSS variables for the warm **light**
   palette under `:root`, and add a **`.dark`** block overriding them for warm dark.
   Add soft `--shadow-*` tokens. Same variable *names* (`--canvas`, `--surface`,
   `--ink`, `--accent`, `--hairline`) so every component re-skins automatically.
2. **Tailwind** (`tailwind.config.ts`): `darkMode: "class"`; add a `boxShadow` scale
   mapped to the shadow tokens; keep the semantic color mapping.
3. **Theme toggle**: a no-flash inline script in `layout.tsx` sets `.dark` from
   `localStorage` before paint; a small `ThemeToggle` client component flips it.
4. **Primitives** get warmer defaults: `Button` (pill/rounded, coral primary, soft
   hover), `Card` (shadow + `rounded-2xl`, no hard border), `Badge` (soft tints),
   `Meter` (coral/green bar). `Shell` becomes a light, friendly top bar.
5. **Surfaces re-skinned**: landing (warm hero, peach gradient, encouraging copy),
   login, and the Today feed.

## Scope & order

1. Tokens + Tailwind + theme toggle + primitives (the system).
2. Landing reskin (the showcase) — review live on localhost.
3. Login + Today feed reskin.
4. Push to GitHub.

This is the surface only — no data/auth/pipeline changes. The S0 SaaS work
(Supabase foundation) is unaffected and resumes when the keys arrive.

## Non-goals

- No new features; no copy for features that don't exist.
- No third-party font dependency (offline-safe; keep self-hosted Geist Sans).
- Not redesigning pipeline/analytics internals — just their visual skin as reached.

## Success

A first-time visitor from any profession finds it warm, clear, and trustworthy,
and the team agrees it looks like something people love — not a tool built for
engineers.
