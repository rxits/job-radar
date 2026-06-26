# Flightdeck P1 — Foundation & Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace job-radar's utilitarian skin with a premium "command deck" design system — tokens, Geist fonts, a motion layer, reusable UI primitives, a new app shell, and a reskinned Today feed — with **zero behavior change**.

**Architecture:** Introduce a token layer (CSS variables → Tailwind semantic utilities), self-hosted Geist fonts, a shared Framer-motion variants module, and a `src/components/ui/` primitives layer. Existing pages keep all their logic and handlers; only their presentation is swapped to the new primitives. Pure presentation/scoring helpers live in `src/lib/ui.ts` and are unit-tested.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v3, `framer-motion`, `lucide-react`, `geist` (font), better-sqlite3 (untouched), vitest.

## Global Constraints

- Aesthetic: **Precision dark · command deck**. Canvas near-black `#0A0A0B`; surfaces raised ~3% + 1px hairline border; depth via layering, not heavy shadows.
- **One accent: warm amber/gold** (`--accent: #F5A623`). Used sparingly — primary action, focus ring, active state, elite-score peak. Never decoratively.
- Geist Sans for UI; **Geist Mono for every number/score/data value**. Self-hosted via `next/font` (zero CLS, zero external request).
- All motion uses compositor-only props (transform/opacity), gated by `prefers-reduced-motion`; 150–220ms `ease-out` baseline.
- No behavior change in P1: every existing handler, route, and query stays byte-for-byte; only JSX/className/imports change.
- Keep `pnpm test` green and `./node_modules/.bin/tsc --noEmit` clean at the end of every task. Runtime AI stays Gemini-only. `data/` stays gitignored.
- Note: `pnpm <script>` may trigger a reinstall prompt in this environment — run binaries directly: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/next build`.

---

### Task 1: Install deps, design tokens, fonts & global base

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx:1-19`

**Interfaces:**
- Produces: Tailwind semantic utilities `bg-canvas`, `bg-surface`, `bg-surface-raised`, `border-hairline`, `border-hairline-strong`, `text-ink`, `text-ink-dim`, `text-ink-faint`, `bg-accent`, `bg-accent-soft`, `text-accent`, `ring-accent`, and `font-sans` / `font-mono` mapped to Geist. CSS variable `--ease-deck`. These are consumed by every later task.

- [ ] **Step 1: Install the three runtime deps**

Run:
```bash
cd ~/studio/code/job-radar && ./node_modules/.bin/pnpm add framer-motion lucide-react geist 2>/dev/null || npm install framer-motion lucide-react geist
```
Expected: `package.json` gains `framer-motion`, `lucide-react`, `geist` under dependencies. If the environment blocks the installer, add them to `package.json` dependencies manually and run `npm install`.

- [ ] **Step 2: Write the token + base layer in `src/app/globals.css`**

Replace the entire file with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --canvas: #0a0a0b;
  --surface: #131316;
  --surface-raised: #1a1a1f;
  --hairline: #26262c;
  --hairline-strong: #34343c;
  --ink: #ededf0;
  --ink-dim: #a1a1aa;
  --ink-faint: #6b6b76;
  --accent: #f5a623;
  --accent-hover: #ffb840;
  --accent-soft: rgba(245, 166, 35, 0.12);
  --accent-ring: rgba(245, 166, 35, 0.5);
  --ease-deck: cubic-bezier(0.22, 1, 0.36, 1);
}

@layer base {
  body {
    @apply bg-canvas text-ink antialiased;
    font-feature-settings: "cv11", "ss01";
  }
  ::selection {
    background: var(--accent-soft);
    color: var(--ink);
  }
  *:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--canvas), 0 0 0 4px var(--accent-ring);
    border-radius: 4px;
  }
  /* slim, on-brand scrollbar */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb {
    background: var(--hairline-strong);
    border-radius: 6px;
    border: 2px solid var(--canvas);
  }
  ::-webkit-scrollbar-track { background: transparent; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Map tokens into Tailwind in `tailwind.config.ts`**

Replace the entire file with:
```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: { DEFAULT: "var(--surface)", raised: "var(--surface-raised)" },
        hairline: { DEFAULT: "var(--hairline)", strong: "var(--hairline-strong)" },
        ink: { DEFAULT: "var(--ink)", dim: "var(--ink-dim)", faint: "var(--ink-faint)" },
        accent: { DEFAULT: "var(--accent)", hover: "var(--accent-hover)", soft: "var(--accent-soft)" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: { deck: "var(--ease-deck)" },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Wire Geist fonts in `src/app/layout.tsx`**

Replace the entire file with:
```tsx
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Shell } from "@/components/ui/shell";

export const metadata = { title: "job-radar" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
```
(`Shell` is created in Task 5. Until then, this import will not resolve — that is expected; Task 1's verification is the build of the token layer, so temporarily keep the old `<nav>`/`<main>` markup from the original file IF you are running Task 1 in isolation. When executing tasks in order, create Task 5's `shell.tsx` before building.)

- [ ] **Step 5: Typecheck and build**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0 (after Task 5 exists). If running Task 1 alone, revert the `Shell` import per the note above and verify the old nav still compiles.

Run: `./node_modules/.bin/next build` (smoke; optional if dev server used)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/app/globals.css tailwind.config.ts src/app/layout.tsx
git commit -m "p1: design tokens, geist fonts, command-deck base layer"
```

---

### Task 2: Pure UI helpers with unit tests

**Files:**
- Create: `src/lib/ui.ts`
- Test: `src/lib/ui.test.ts`

**Interfaces:**
- Produces:
  - `cn(...parts: Array<string | false | null | undefined>): string`
  - `type Tier = "low" | "mid" | "high" | "elite"`
  - `scoreTier(score: number | null): Tier`
  - `tierMeta(tier: Tier): { label: string; barClass: string; textClass: string }`
  - `regionLabel(region: string | null): string | null`

- [ ] **Step 1: Write the failing test in `src/lib/ui.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cn, scoreTier, tierMeta, regionLabel } from "./ui";

describe("cn", () => {
  it("joins truthy parts and drops falsy ones", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("scoreTier", () => {
  it("bands scores into tiers", () => {
    expect(scoreTier(92)).toBe("elite");
    expect(scoreTier(85)).toBe("elite");
    expect(scoreTier(72)).toBe("high");
    expect(scoreTier(55)).toBe("mid");
    expect(scoreTier(20)).toBe("low");
    expect(scoreTier(null)).toBe("low");
  });
});

describe("tierMeta", () => {
  it("gives every tier a label and classes", () => {
    for (const t of ["low", "mid", "high", "elite"] as const) {
      const m = tierMeta(t);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.barClass.length).toBeGreaterThan(0);
      expect(m.textClass.length).toBeGreaterThan(0);
    }
    expect(tierMeta("elite").textClass).toContain("accent");
  });
});

describe("regionLabel", () => {
  it("maps known regions and hides noise", () => {
    expect(regionLabel("us")).toBe("US");
    expect(regionLabel("worldwide")).toBe("Worldwide");
    expect(regionLabel("other")).toBeNull();
    expect(regionLabel(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./node_modules/.bin/vitest run src/lib/ui.test.ts`
Expected: FAIL — `Failed to resolve import "./ui"`.

- [ ] **Step 3: Implement `src/lib/ui.ts`**

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Tier = "low" | "mid" | "high" | "elite";

export function scoreTier(score: number | null): Tier {
  if (score == null) return "low";
  if (score >= 85) return "elite";
  if (score >= 70) return "high";
  if (score >= 50) return "mid";
  return "low";
}

export function tierMeta(tier: Tier): { label: string; barClass: string; textClass: string } {
  switch (tier) {
    case "elite": return { label: "Elite match", barClass: "bg-accent", textClass: "text-accent" };
    case "high":  return { label: "Strong match", barClass: "bg-emerald-400", textClass: "text-emerald-300" };
    case "mid":   return { label: "Fair match", barClass: "bg-ink-dim", textClass: "text-ink-dim" };
    case "low":   return { label: "Weak match", barClass: "bg-ink-faint", textClass: "text-ink-faint" };
  }
}

const REGION_LABELS: Record<string, string> = {
  us: "US", eu: "EU", au: "AU", worldwide: "Worldwide",
};

export function regionLabel(region: string | null): string | null {
  if (!region) return null;
  return REGION_LABELS[region] ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `./node_modules/.bin/vitest run src/lib/ui.test.ts`
Expected: PASS (4 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui.ts src/lib/ui.test.ts
git commit -m "p1: pure ui helpers (cn, scoreTier, tierMeta, regionLabel) + tests"
```

---

### Task 3: Motion variants module

**Files:**
- Create: `src/lib/motion.ts`

**Interfaces:**
- Produces: `fadeInUp`, `staggerParent`, `staggerChild`, `drawerVariants` (Framer `Variants`), and `DECK_EASE: number[]`. Consumed by Task 4 (primitives) and Task 6 (feed).

- [ ] **Step 1: Create `src/lib/motion.ts`**

```ts
import type { Variants } from "framer-motion";

export const DECK_EASE = [0.22, 1, 0.36, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: DECK_EASE } },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: DECK_EASE } },
};

export const drawerVariants: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { duration: 0.26, ease: DECK_EASE } },
  exit: { x: "100%", transition: { duration: 0.2, ease: DECK_EASE } },
};
```

- [ ] **Step 2: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/motion.ts
git commit -m "p1: shared framer-motion variants"
```

---

### Task 4: UI primitives — Badge, Button, Card, Meter, Kbd

**Files:**
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/meter.tsx`
- Create: `src/components/ui/kbd.tsx`

**Interfaces:**
- Consumes: `cn`, `scoreTier`, `tierMeta` from `src/lib/ui.ts`.
- Produces:
  - `<Badge variant?="neutral"|"accent"|"success"|"danger"|"muted" title?>` 
  - `<Button variant?="primary"|"ghost"|"danger" size?="sm"|"md" {...buttonProps}>`
  - `<Card className? {...divProps}>` and `<Card>` is a styled `div`
  - `<Meter score={number|null} />`
  - `<Kbd>{string}</Kbd>`

- [ ] **Step 1: Create `src/components/ui/badge.tsx`**

```tsx
import { cn } from "@/lib/ui";

type Variant = "neutral" | "accent" | "success" | "danger" | "muted";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-hairline-strong text-ink-dim",
  accent: "border-accent/40 text-accent bg-accent-soft",
  success: "border-emerald-700/50 text-emerald-300",
  danger: "border-red-800/50 text-red-300",
  muted: "border-transparent text-ink-faint",
};

export function Badge({
  variant = "neutral",
  className,
  title,
  children,
}: {
  variant?: Variant;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create `src/components/ui/button.tsx`**

```tsx
import { cn } from "@/lib/ui";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-black hover:bg-accent-hover font-semibold",
  ghost: "bg-surface-raised text-ink-dim hover:text-ink hover:bg-hairline border border-hairline",
  danger: "bg-transparent text-red-400 border border-red-900/60 hover:bg-red-950/40",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-sm",
};

export function Button({
  variant = "ghost",
  size = "sm",
  className,
  ...props
}: { variant?: Variant; size?: Size } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors duration-150 ease-deck disabled:opacity-50 disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    />
  );
}
```

- [ ] **Step 3: Create `src/components/ui/card.tsx`**

```tsx
import { cn } from "@/lib/ui";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-xl border border-hairline bg-surface transition-colors duration-150 ease-deck",
        className,
      )}
    />
  );
}
```

- [ ] **Step 4: Create `src/components/ui/meter.tsx`**

```tsx
import { cn, scoreTier, tierMeta } from "@/lib/ui";

export function Meter({ score }: { score: number | null }) {
  const tier = scoreTier(score);
  const meta = tierMeta(tier);
  const pct = score == null ? 0 : Math.max(4, Math.min(100, score));
  return (
    <div className="flex items-center gap-2" title={`${meta.label}${score != null ? ` · ${score}/100` : ""}`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-hairline">
        <div className={cn("h-full rounded-full transition-all duration-300 ease-deck", meta.barClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("font-mono text-xs tabular-nums", meta.textClass)}>
        {score ?? "—"}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/ui/kbd.tsx`**

```tsx
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-hairline-strong bg-surface-raised px-1 py-0.5 font-mono text-[10px] text-ink-dim">
      {children}
    </kbd>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/button.tsx src/components/ui/card.tsx src/components/ui/meter.tsx src/components/ui/kbd.tsx
git commit -m "p1: ui primitives — badge, button, card, meter, kbd"
```

---

### Task 5: New app shell & navigation

**Files:**
- Create: `src/components/ui/shell.tsx`
- (Consumed by `src/app/layout.tsx` from Task 1)

**Interfaces:**
- Consumes: `cn` from `@/lib/ui`; `lucide-react` icons.
- Produces: `<Shell>{children}</Shell>` — a client component rendering the top nav (brand + links with active state + icons + a non-functional `⌘K` hint chip) and the `<main>` wrapper. The `⌘K` chip is visual only in P1; it is wired in P2.

- [ ] **Step 1: Create `src/components/ui/shell.tsx`**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, LayoutGrid, BarChart3, User } from "lucide-react";
import { cn } from "@/lib/ui";
import { Kbd } from "./kbd";

const LINKS = [
  { href: "/", label: "Today", icon: Radar },
  { href: "/pipeline", label: "Pipeline", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-5 py-2.5">
          <Link href="/" className="mr-3 flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent">
              <Radar size={14} strokeWidth={2.5} />
            </span>
            job-radar
          </Link>
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-deck",
                  active ? "bg-surface-raised text-ink" : "text-ink-faint hover:text-ink-dim",
                )}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5 rounded-md border border-hairline px-2 py-1 text-ink-faint">
            <span className="text-xs">Search</span>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-7">{children}</main>
    </>
  );
}
```

- [ ] **Step 2: Confirm `layout.tsx` (from Task 1) imports and renders `<Shell>`**

Verify `src/app/layout.tsx` matches the Task 1 Step 4 version (imports `Shell`, wraps `{children}`). No old `<nav>` remains.

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Visual verification**

Run dev server: `./node_modules/.bin/next dev` then open `http://localhost:3000`.
Expected: sticky translucent top bar, amber brand mark, active link highlighted, `⌘K` chip on the right, near-black canvas, Geist font rendering. Stop the server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/shell.tsx
git commit -m "p1: command-deck app shell + nav with active state and ⌘K hint"
```

---

### Task 6: Reskin the Today feed & JobCard

**Files:**
- Modify: `src/app/feed.tsx` (presentation only — all handlers/state preserved)

**Interfaces:**
- Consumes: `Card`, `Badge`, `Button`, `Meter` from `@/components/ui/*`; `cn`, `regionLabel` from `@/lib/ui`; `fadeInUp`, `staggerParent`, `staggerChild` from `@/lib/motion`; `motion` from `framer-motion`; icons from `lucide-react`.

- [ ] **Step 1: Replace the imports + `EligBadge` + `JobCard` block in `feed.tsx`**

At the top of `src/app/feed.tsx`, after `"use client";`, ensure these imports exist (add the new ones; keep `useState`, `JobRow`, `ScrapeReport`):
```tsx
"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, MapPin, Building2 } from "lucide-react";
import type { JobRow } from "@/lib/types";
import type { ScrapeReport } from "@/lib/scrape";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Meter } from "@/components/ui/meter";
import { cn, regionLabel } from "@/lib/ui";
import { fadeInUp, staggerParent, staggerChild } from "@/lib/motion";
```

Replace the existing `stripHtml` (keep it), delete the old `EligBadge` function, and replace the entire `JobCard` function with:
```tsx
function EligBadge({ j }: { j: JobRow }) {
  if (j.eligibility === "eligible")
    return <Badge variant="success" title={j.eligibilityReason ?? "eligible"}>eligible</Badge>;
  if (j.eligibility === "ineligible")
    return <Badge variant="danger" title={j.eligibilityReason ?? "ineligible"}>ineligible</Badge>;
  return <Badge variant="muted" title={j.eligibilityReason ?? "eligibility unknown"}>unknown</Badge>;
}

function JobCard({
  j, onApply, onSkip, onSave, saved,
}: {
  j: JobRow; onApply: () => void; onSkip: () => void; onSave: () => void; saved: boolean;
}) {
  const excerpt = stripHtml(j.description ?? "");
  const region = regionLabel(j.region);
  return (
    <Card className="group p-4 hover:border-hairline-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={j.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink hover:text-accent"
          >
            <Building2 size={14} className="text-ink-faint" />
            {j.company}
            <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-60" />
          </a>
          <div className="truncate text-sm text-ink-dim">{j.title}</div>
        </div>
        <div className="shrink-0">{j.score != null && <Meter score={j.score} />}</div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EligBadge j={j} />
        {j.payTier === "high" && <Badge variant="accent" title="High pay band">high&nbsp;pay</Badge>}
        {region && <Badge title="Region">{region}</Badge>}
        {j.isInternship && <Badge title="Internship">intern</Badge>}
        {j.aiFriendly != null && j.aiFriendly >= 60 && (
          <Badge title="AI-friendly company signal">AI&nbsp;{j.aiFriendly}</Badge>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
        {[j.salary, j.location, j.source].filter(Boolean).map((bit, i, arr) => (
          <span key={i} className="flex items-center gap-1.5">
            {i === 1 && <MapPin size={10} />}
            {bit}
            {i < arr.length - 1 && <span className="text-hairline-strong">·</span>}
          </span>
        ))}
      </div>

      {j.reason && <p className="mt-2 text-xs italic text-ink-dim">{j.reason}</p>}
      {excerpt && <p className="mt-1 line-clamp-2 text-xs text-ink-faint">{excerpt}</p>}

      <div className="mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={onApply}>Apply</Button>
        <Button variant="ghost" onClick={onSkip}>Skip</Button>
        {saved ? (
          <Badge variant="accent" className="px-2.5 py-1">Saved ✓</Badge>
        ) : (
          <Button variant="ghost" onClick={onSave}>☆ Save</Button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Restyle the `Feed` return — header, filter bar, and card list**

Inside the `Feed` component, keep **all** state and handler functions exactly as they are. Replace only the returned JSX. Change the outer wrapper, the `<h1>`, the Refresh/Show-seen buttons to `<Button>`, and wrap the job list in motion. Specifically:

Replace `<div className="mx-auto max-w-3xl space-y-6">` with `<div className="space-y-6">` (the shell already centers/pads).

Replace the header `<h1>` and its two buttons with:
```tsx
<div className="flex flex-wrap items-center gap-3">
  <h1 className="flex-1 text-xl font-bold tracking-tight">
    Today <span className="font-mono text-ink-faint">· {jobs.length} new</span>
  </h1>
  <Button variant="primary" size="md" onClick={handleRefresh} disabled={busy}>
    {busy ? "Scanning…" : "Refresh radar"}
  </Button>
  <Button variant="ghost" size="md" onClick={toggleShowSeen}>
    {showSeen ? "Hide seen" : "Show seen"}
  </Button>
</div>
```

In the filter bar, leave the logic; only swap the inline `className` strings of the region/high-pay/intern buttons so the active state uses the accent. For each region button use:
```tsx
className={cn(
  "rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 ease-deck",
  region === r.v ? "bg-accent-soft text-accent" : "bg-surface-raised text-ink-faint hover:text-ink-dim",
)}
```
For the High-pay and Internships toggles, use the same pattern with their `highPayOnly`/`internOnly` booleans driving the active branch.

Wrap the job cards list (the `jobs.map(...)` branch) in a motion stagger container:
```tsx
<motion.div className="space-y-3" variants={staggerParent} initial="hidden" animate="show">
  {jobs.map((j) => (
    <motion.div key={j.id} variants={staggerChild}>
      <JobCard
        j={j}
        onApply={() => handleApply(j)}
        onSkip={() => handleSkip(j)}
        onSave={() => handleSave(j)}
        saved={savedIds.has(j.id)}
      />
    </motion.div>
  ))}
</motion.div>
```

Wrap the empty-state in a `<Card className="p-10 text-center text-ink-dim">` instead of the old bordered div, and the follow-up strip / refresh-summary may keep their structure but swap `bg-neutral-*`/`border-neutral-*` classes to `bg-surface`/`border-hairline` and amber where appropriate (`text-amber-*` → keep amber, it now matches the accent family).

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Full test suite (guard against regressions)**

Run: `./node_modules/.bin/vitest run`
Expected: all tests pass (149: prior 143 + 6 new from Task 2). No test touches `feed.tsx`, so behavior is unchanged.

- [ ] **Step 5: Visual verification**

Run `./node_modules/.bin/next dev`, open `http://localhost:3000`. With no profile you'll hit `/setup` — that's fine; to view the feed, ensure a profile exists or inspect via existing data. Confirm: cards stagger in, score renders as an amber/emerald meter, badges are quiet and consistent (no emoji soup), hover lifts the border, Apply is the amber primary. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/app/feed.tsx
git commit -m "p1: reskin Today feed + JobCard with command-deck primitives + motion"
```

---

## Self-Review

**Spec coverage (P1 scope):**
- Design tokens + near-black canvas + amber accent → Task 1. ✓
- Geist Sans/Mono self-hosted → Task 1. ✓
- Motion layer (compositor-only, reduced-motion) → Task 1 (media query) + Task 3 (variants) + Task 6 (usage). ✓
- `ui/` primitives layer → Task 4. ✓
- Kill tag soup / score-as-meter → Task 2 (tier logic) + Task 4 (Meter/Badge) + Task 6 (JobCard). ✓
- New app shell/nav → Task 5. ✓
- Reskinned Today feed → Task 6. ✓
- No behavior change → enforced in Task 6 (handlers preserved) + full suite in Task 6 Step 4. ✓
- P2–P5 features (palette, drawer, subscores, analytics, automation) are explicitly **out of P1 scope** — deferred to their own plans.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". The only forward-reference is the `⌘K` chip (visual-only in P1, wired in P2) — called out explicitly. ✓

**Type consistency:** `cn`/`scoreTier`/`tierMeta`/`regionLabel` signatures defined in Task 2 are used unchanged in Tasks 4 & 6. `Meter` takes `score: number | null`; `JobCard` passes `j.score` (typed `number | null`). `Shell` consumes only `cn` + lucide. Primitive prop names (`variant`, `size`, `score`) consistent across definition and use. ✓

**Ordering note:** `layout.tsx` (Task 1) imports `Shell` (Task 5). When executing in order, create `shell.tsx` before the final typecheck, or follow the Task 1 Step 4 note to keep the old nav temporarily. Flagged in both tasks.
