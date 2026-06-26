# SaaS S0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local SQLite layer with a multi-tenant Supabase foundation — Postgres schema + RLS, Supabase Auth, an async user-scoped data layer, encrypted BYOK Gemini keys, and a serverless-safe pipeline — so the existing pages work multi-user with per-user data isolation.

**Architecture:** All pure domain logic (sources, classify, normalize, eligibility, match prompts, tailor, enrich, digest, ui) is untouched. The `Db` interface becomes async and is reimplemented against a request-scoped Supabase server client so Row-Level Security applies per user. Auth uses `@supabase/ssr` cookie sessions. BYOK keys live encrypted in Supabase Vault. The scrape→match pipeline is decoupled via a `runs` table the dashboard polls.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + Auth + Vault), `@supabase/ssr`, `@supabase/supabase-js`, Supabase CLI (local Postgres for tests), vitest, Gemini (`@google/genai`).

## Global Constraints

- Built on branch `saas-foundation`; the SQLite app on `main` keeps working until this merges (clean cutover).
- Every domain table has `user_id uuid not null references auth.users(id)` and an RLS policy `using (user_id = auth.uid())` for all of select/insert/update/delete.
- `jobs` uniqueness is `unique(user_id, dedupe_key)`.
- Secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ENCRYPTION_KEY`) live in `.env.local` / Vercel — never committed. `.env.local` is gitignored.
- BYOK Gemini key is never returned to the browser after save; the client only learns "set / not set".
- Runtime AI is Gemini only, called with the requesting user's key. A user with no key gets a clear "add your Gemini key in Settings" error, never a crash.
- Pure logic modules are not modified except to `await` the now-async `Db`.
- SQL lives in versioned files under `supabase/migrations/`, not inline strings.
- Keep `pnpm test` green and `./node_modules/.bin/tsc --noEmit` clean at the end of every task. Run binaries directly (`./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`) — `pnpm <script>` may trigger a reinstall in this environment.
- Note: the lockfile is out of sync with `package.json` (known pnpm store issue); install new deps the same pragmatic way the project already does, and record them in `package.json`.

---

### Task 1: Branch, Supabase CLI scaffold, deps, env

**Files:**
- Create: `supabase/config.toml` (via CLI), `.env.local.example`, `.gitignore` (modify)
- Modify: `package.json` (deps + scripts)

**Interfaces:**
- Produces: a `saas-foundation` branch; `supabase` CLI project initialized; `@supabase/supabase-js` + `@supabase/ssr` installed; env template documenting required vars.

- [ ] **Step 1: Create the branch**

Run:
```bash
cd ~/studio/code/job-radar && git checkout -b saas-foundation
```
Expected: `Switched to a new branch 'saas-foundation'`.

- [ ] **Step 2: Install the Supabase JS + SSR deps**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```
If npm collides with the pnpm store (as the project has seen), fall back to the project's established approach: `npm pack <pkg>@<ver>` for each + their deps and extract into `node_modules`, then record both in `package.json` `dependencies`. Verify resolution:
```bash
node -e "require('@supabase/supabase-js'); require('@supabase/ssr'); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Install the Supabase CLI and init**

Run:
```bash
npx --yes supabase init
```
Expected: creates `supabase/config.toml` and `supabase/` dir. (If `supabase init` asks about VS Code/Deno settings, accept defaults.)

- [ ] **Step 4: Add scripts to `package.json`**

Add to `scripts`:
```json
"db:start": "supabase start",
"db:reset": "supabase db reset",
"db:push": "supabase db push"
```

- [ ] **Step 5: Create `.env.local.example` and gitignore `.env.local`**

`.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# Only needed if using the app-level encryption fallback instead of Vault:
APP_ENCRYPTION_KEY=
```
Append to `.gitignore` (if not already present): `.env.local` and `supabase/.branches` and `supabase/.temp`.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore .env.local.example supabase/config.toml
git commit -m "s0: branch + supabase CLI scaffold + @supabase/{supabase-js,ssr} + env template"
```

---

### Task 2: Initial migration — schema, RLS, profile trigger, indexes

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `profiles, jobs, matches, contacts, kits, tailored, status_history, runs` (all with `user_id` + RLS), the `unique(user_id, dedupe_key)` constraint on `jobs`, indexes, and an `auth.users` → `public.profiles` insert trigger. Consumed by every later task and the data-layer tests.

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
-- Domain schema for job-radar SaaS. Every table is user-scoped + RLS-protected.

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_text text not null default '',
  core_skills text not null default '',
  location text,
  timezone text,
  preferences text,
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  source text not null,
  company text not null,
  title text not null,
  location text,
  remote boolean not null default false,
  salary text,
  url text not null,
  description text not null default '',
  posted_at text,
  scraped_at timestamptz not null default now(),
  status text not null default 'to_apply'
    check (status in ('to_apply','applied','interviewing','offer','rejected','archived')),
  geo_raw text,
  eligibility text not null default 'unknown',
  eligibility_reason text,
  starred boolean not null default false,
  seen_at timestamptz,
  is_internship boolean not null default false,
  pay_tier text,
  region text,
  unique (user_id, dedupe_key)
);

create table public.matches (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  reason text not null,
  model text not null,
  ai_friendly int,
  matched_at timestamptz not null default now()
);

create table public.contacts (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company text, person_name text, person_title text,
  emails jsonb not null default '[]', links jsonb not null default '[]',
  source text, confidence text, model text,
  created_at timestamptz not null default now()
);

create table public.kits (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_md text not null, cover_md text not null, outreach_md text not null,
  model text not null, created_at timestamptz not null default now()
);

create table public.tailored (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  markdown text not null, model text not null,
  created_at timestamptz not null default now()
);

create table public.status_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status text not null, to_status text not null,
  changed_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('scrape','match','refresh')),
  status text not null default 'running' check (status in ('running','done','error')),
  fetched int not null default 0,
  inserted int not null default 0,
  scored int not null default 0,
  failed int not null default 0,
  report jsonb not null default '[]',
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Indexes
create index jobs_user_status_idx on public.jobs(user_id, status);
create index jobs_user_elig_idx on public.jobs(user_id, eligibility);
create index runs_user_idx on public.runs(user_id, started_at desc);

-- RLS: enable + owner-only policy on every table
do $$
declare t text;
begin
  foreach t in array array['profiles','jobs','matches','contacts','kits','tailored','status_history','runs']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$create policy %I on public.%I
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());$p$,
      t || '_owner', t);
  end loop;
end $$;

-- Auto-create a profile row when a user signs up
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Start local Supabase and apply the migration**

Run:
```bash
./node_modules/.bin/supabase start && ./node_modules/.bin/supabase db reset
```
Expected: containers start; `db reset` applies `0001_init.sql` with no SQL errors. Note the printed `API URL` and `anon key` for `.env.local`.

- [ ] **Step 3: Verify schema + RLS exist**

Run:
```bash
./node_modules/.bin/supabase db reset 2>&1 | tail -5
```
Expected: clean apply. (Deeper RLS assertions come as automated tests in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "s0: initial schema — user-scoped tables, RLS, profile trigger, runs"
```

---

### Task 3: Supabase client factories, middleware, minimal auth

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/api/auth/signout/route.ts`

**Interfaces:**
- Produces:
  - `createBrowserClient()` → `SupabaseClient` (client components)
  - `createServerClient()` → `Promise<SupabaseClient>` (Server Components / Route Handlers; reads/writes session cookie)
  - `createServiceClient()` → `SupabaseClient` (service-role; cron only; bypasses RLS)
  - `getUser()` → `Promise<{ id: string; email: string } | null>` (server)
  - middleware that refreshes the session and redirects unauthenticated dashboard requests to `/login`, returns 401 for `/api/*`.

- [ ] **Step 1: Browser client `src/lib/supabase/client.ts`**

```ts
"use client";
import { createBrowserClient as create } from "@supabase/ssr";

export function createBrowserClient() {
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Server client `src/lib/supabase/server.ts`**

```ts
import { cookies } from "next/headers";
import { createServerClient as create } from "@supabase/ssr";

export async function createServerClient() {
  const store = await cookies();
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => store.set(name, value, options)); }
          catch { /* called from a Server Component render — safe to ignore */ }
        },
      },
    },
  );
}

export async function getUser() {
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}
```

- [ ] **Step 3: Service client `src/lib/supabase/service.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 4: Middleware `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/auth"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|woff2)$).*)"],
};
```

- [ ] **Step 5: Minimal login `src/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Login() {
  const sb = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function emailAuth(mode: "in" | "up") {
    setMsg(null);
    const fn = mode === "in" ? sb.auth.signInWithPassword : sb.auth.signUp;
    const { error } = await fn({ email, password });
    if (error) setMsg(error.message);
    else window.location.href = "/";
  }
  async function google() {
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card className="space-y-3 p-6">
        <h1 className="text-lg font-bold tracking-tight">Sign in to job-radar</h1>
        <input className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-md border border-hairline bg-surface-raised px-3 py-2 text-sm" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => emailAuth("in")}>Sign in</Button>
          <Button variant="ghost" onClick={() => emailAuth("up")}>Sign up</Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={google}>Continue with Google</Button>
        {msg && <p className="text-xs text-red-400">{msg}</p>}
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: OAuth callback `src/app/auth/callback/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await createServerClient();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
```

- [ ] **Step 7: Sign-out `src/app/api/auth/signout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const sb = await createServerClient();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/login", new URL(req.url).origin));
}
```

- [ ] **Step 8: Typecheck and commit**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: exit 0.
```bash
git add src/lib/supabase src/middleware.ts src/app/login src/app/auth src/app/api/auth
git commit -m "s0: supabase client factories, session middleware, minimal auth"
```

---

### Task 4: Async user-scoped data layer

**Files:**
- Create: `src/lib/data.ts` (the new data layer)
- Modify: `src/lib/types.ts` (make the `Db` interface async)
- Remove (later, in Task 5): `src/lib/db.ts`, `src/lib/server-db.ts`

**Interfaces:**
- Consumes: `createServerClient()` from `@/lib/supabase/server`; row/domain types from `@/lib/types`.
- Produces: `getData(): Promise<Db>` returning an async, request-scoped data layer. The `Db` interface (in `types.ts`) becomes:
  ```ts
  export interface Db {
    upsertJobs(jobs: NormalizedJob[]): Promise<number>;
    listJobs(f: JobFilter): Promise<JobRow[]>;
    unscoredJobs(): Promise<JobRow[]>;
    getJob(id: string): Promise<JobRow | null>;
    setStatus(id: string, status: Status): Promise<void>;
    markSeen(id: string): Promise<void>;
    setStarred(id: string, starred: boolean): Promise<void>;
    needsFollowUp(days?: number): Promise<JobRow[]>;
    saveMatch(id: string, score: number, reason: string, model: string, aiFriendly?: number | null): Promise<void>;
    setEligibility(id: string, e: Eligibility, reason: string | null): Promise<void>;
    statusHistory(): Promise<{ jobId: string; from: string; to: string; changedAt: string }[]>;
    recentActivity(limit?: number): Promise<{ company: string; title: string; from: string; to: string; changedAt: string }[]>;
    getProfile(): Promise<{ resumeText: string; coreSkills: string; location: string | null; timezone: string | null; preferences: string | null } | null>;
    saveProfile(resumeText: string, coreSkills: string, location?: string | null, timezone?: string | null, preferences?: string | null): Promise<void>;
    saveTailored(jobId: string, markdown: string, model: string): Promise<void>;
    getTailored(jobId: string): Promise<{ markdown: string; model: string; createdAt: string } | null>;
    saveKit(jobId: string, kit: { resumeMd: string; coverMd: string; outreachMd: string }, model: string): Promise<void>;
    getKit(jobId: string): Promise<Kit | null>;
    saveContact(c: Contact, model: string): Promise<void>;
    getContact(jobId: string): Promise<Contact | null>;
  }
  ```
  `JobFilter` is unchanged. The old `raw: Database.Database` member is removed.

- [ ] **Step 1: Update the `Db` interface in `src/lib/types.ts`**

Move the `Db` and `JobFilter` interface definitions from `db.ts` into `types.ts` (or keep them in `types.ts` if cleaner) with every method returning a `Promise` as shown in Interfaces above. Drop `raw`. Keep `JobRow`, `Contact`, `Kit`, etc. unchanged.

- [ ] **Step 2: Implement the data layer — row mapping + every query**

Create `src/lib/data.ts`. The Supabase rows use snake_case; map to the camelCase `JobRow`. The user scope is automatic via RLS, but every insert must set `user_id` explicitly (RLS `with check`). Get the current user id once per `getData()`.

Full implementation (every method — this is the heart of S0):

```ts
import { createServerClient } from "./supabase/server";
import type {
  Contact, Db, Eligibility, JobFilter, JobRow, Kit, NormalizedJob, Status,
} from "./types";
import { detectInternship, payTier, regionOf } from "./classify";

const JOB_COLS =
  "id,user_id,dedupe_key,source,company,title,location,remote,salary,url,description,posted_at,scraped_at,status,geo_raw,eligibility,eligibility_reason,starred,seen_at,is_internship,pay_tier,region";

function toJob(r: any, m?: any): JobRow {
  return {
    id: r.id, dedupeKey: r.dedupe_key, source: r.source, company: r.company,
    title: r.title, location: r.location, remote: r.remote, salary: r.salary,
    url: r.url, description: r.description, postedAt: r.posted_at, geoRaw: r.geo_raw,
    status: r.status, scrapedAt: r.scraped_at,
    eligibility: r.eligibility, eligibilityReason: r.eligibility_reason,
    starred: r.starred, seenAt: r.seen_at,
    isInternship: r.is_internship, payTier: r.pay_tier, region: r.region,
    score: m?.score ?? r.match_score ?? null,
    reason: m?.reason ?? r.match_reason ?? null,
    aiFriendly: m?.ai_friendly ?? r.match_ai_friendly ?? null,
    hasTailored: !!r.has_tailored, hasKit: !!r.has_kit,
  };
}

export async function getData(): Promise<Db> {
  const sb = await createServerClient();
  const { data: au } = await sb.auth.getUser();
  const uid = au.user?.id;
  if (!uid) throw new Error("not authenticated");

  // Helper: attach match/has-kit/has-tailored to a set of jobs in one extra round-trip.
  async function decorate(jobs: any[]): Promise<JobRow[]> {
    if (jobs.length === 0) return [];
    const ids = jobs.map((j) => j.id);
    const [{ data: ms }, { data: ks }, { data: ts }] = await Promise.all([
      sb.from("matches").select("job_id,score,reason,ai_friendly").in("job_id", ids),
      sb.from("kits").select("job_id").in("job_id", ids),
      sb.from("tailored").select("job_id").in("job_id", ids),
    ]);
    const mById = new Map((ms ?? []).map((m) => [m.job_id, m]));
    const kSet = new Set((ks ?? []).map((k) => k.job_id));
    const tSet = new Set((ts ?? []).map((t) => t.job_id));
    return jobs.map((j) =>
      toJob({ ...j, has_kit: kSet.has(j.id), has_tailored: tSet.has(j.id) }, mById.get(j.id)),
    );
  }

  return {
    async upsertJobs(jobs: NormalizedJob[]) {
      if (jobs.length === 0) return 0;
      const rows = jobs.map((j) => ({
        user_id: uid, dedupe_key: j.dedupeKey, source: j.source, company: j.company,
        title: j.title, location: j.location, remote: j.remote, salary: j.salary,
        url: j.url, description: j.description, posted_at: j.postedAt, geo_raw: j.geoRaw ?? null,
        is_internship: detectInternship(j.title, j.description),
        pay_tier: payTier(j.salary), region: regionOf(j.location, j.geoRaw),
      }));
      // onConflict on (user_id, dedupe_key); ignoreDuplicates so re-scrape is idempotent.
      const { data, error } = await sb.from("jobs")
        .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },

    async listJobs(f: JobFilter) {
      let q = sb.from("jobs").select(JOB_COLS);
      if (f.source) q = q.eq("source", f.source);
      if (f.remote !== undefined) q = q.eq("remote", f.remote);
      if (f.status) q = q.eq("status", f.status);
      if (f.query) q = q.or(`company.ilike.%${f.query}%,title.ilike.%${f.query}%,description.ilike.%${f.query}%`);
      if (f.eligibility && f.eligibility.length) q = q.in("eligibility", f.eligibility);
      if (f.unseenOnly) q = q.is("seen_at", null);
      if (f.starred) q = q.eq("starred", true);
      if (f.region) q = q.eq("region", f.region);
      if (f.payTier) q = q.eq("pay_tier", f.payTier);
      if (f.internship !== undefined) q = q.eq("is_internship", f.internship);
      if (f.actioned) q = q.or("status.neq.to_apply,starred.eq.true");
      const { data, error } = await q;
      if (error) throw error;
      let jobs = await decorate(data ?? []);
      if (f.minScore !== undefined) jobs = jobs.filter((j) => (j.score ?? -1) >= f.minScore!);
      // Rank: high-pay first, then score desc, then ai-friendly desc, then recency.
      jobs.sort((a, b) =>
        Number(b.payTier === "high") - Number(a.payTier === "high") ||
        (b.score ?? -1) - (a.score ?? -1) ||
        (b.aiFriendly ?? -1) - (a.aiFriendly ?? -1) ||
        (b.scrapedAt < a.scrapedAt ? -1 : 1),
      );
      return jobs;
    },

    async unscoredJobs() {
      const { data: scored } = await sb.from("matches").select("job_id");
      const scoredIds = new Set((scored ?? []).map((m) => m.job_id));
      const { data, error } = await sb.from("jobs").select(JOB_COLS).neq("eligibility", "ineligible");
      if (error) throw error;
      const fresh = (data ?? []).filter((j) => !scoredIds.has(j.id));
      return decorate(fresh);
    },

    async getJob(id: string) {
      const { data, error } = await sb.from("jobs").select(JOB_COLS).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return (await decorate([data]))[0];
    },

    async setStatus(id: string, status: Status) {
      const { data: cur } = await sb.from("jobs").select("status").eq("id", id).maybeSingle();
      if (!cur || cur.status === status) return;
      const { error } = await sb.from("jobs").update({ status }).eq("id", id);
      if (error) throw error;
      await sb.from("status_history").insert({ user_id: uid, job_id: id, from_status: cur.status, to_status: status });
    },

    async markSeen(id: string) {
      await sb.from("jobs").update({ seen_at: new Date().toISOString() }).eq("id", id).is("seen_at", null);
    },

    async setStarred(id: string, starred: boolean) {
      await sb.from("jobs").update({ starred }).eq("id", id);
    },

    async needsFollowUp(days = 7) {
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: applied } = await sb.from("jobs").select(JOB_COLS).eq("status", "applied");
      const ids = (applied ?? []).map((j) => j.id);
      if (ids.length === 0) return [];
      const { data: recent } = await sb.from("status_history").select("job_id").in("job_id", ids).gt("changed_at", cutoff);
      const moved = new Set((recent ?? []).map((h) => h.job_id));
      const stale = (applied ?? []).filter((j) => !moved.has(j.id));
      return decorate(stale);
    },

    async saveMatch(id, score, reason, model, aiFriendly) {
      const { error } = await sb.from("matches").upsert({
        job_id: id, user_id: uid, score, reason, model, ai_friendly: aiFriendly ?? null,
        matched_at: new Date().toISOString(),
      }, { onConflict: "job_id" });
      if (error) throw error;
    },

    async setEligibility(id, e: Eligibility, reason) {
      await sb.from("jobs").update({ eligibility: e, eligibility_reason: reason }).eq("id", id);
    },

    async statusHistory() {
      const { data } = await sb.from("status_history").select("job_id,from_status,to_status,changed_at").order("changed_at");
      return (data ?? []).map((h) => ({ jobId: h.job_id, from: h.from_status, to: h.to_status, changedAt: h.changed_at }));
    },

    async recentActivity(limit = 20) {
      const { data } = await sb.from("status_history")
        .select("from_status,to_status,changed_at,jobs(company,title)")
        .order("changed_at", { ascending: false }).limit(limit);
      return (data ?? []).map((h: any) => ({
        company: h.jobs?.company ?? "", title: h.jobs?.title ?? "",
        from: h.from_status, to: h.to_status, changedAt: h.changed_at,
      }));
    },

    async getProfile() {
      const { data } = await sb.from("profiles").select("resume_text,core_skills,location,timezone,preferences").maybeSingle();
      if (!data) return null;
      return {
        resumeText: data.resume_text, coreSkills: data.core_skills,
        location: data.location ?? null, timezone: data.timezone ?? null, preferences: data.preferences ?? null,
      };
    },

    async saveProfile(resumeText, coreSkills, location, timezone, preferences) {
      const { error } = await sb.from("profiles").upsert({
        user_id: uid, resume_text: resumeText, core_skills: coreSkills,
        location: location ?? null, timezone: timezone ?? null, preferences: preferences ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
    },

    async saveTailored(jobId, markdown, model) {
      await sb.from("tailored").upsert({ job_id: jobId, user_id: uid, markdown, model, created_at: new Date().toISOString() }, { onConflict: "job_id" });
    },

    async getTailored(jobId) {
      const { data } = await sb.from("tailored").select("markdown,model,created_at").eq("job_id", jobId).maybeSingle();
      return data ? { markdown: data.markdown, model: data.model, createdAt: data.created_at } : null;
    },

    async saveKit(jobId, kit, model) {
      await sb.from("kits").upsert({
        job_id: jobId, user_id: uid, resume_md: kit.resumeMd, cover_md: kit.coverMd,
        outreach_md: kit.outreachMd, model, created_at: new Date().toISOString(),
      }, { onConflict: "job_id" });
    },

    async getKit(jobId): Promise<Kit | null> {
      const { data } = await sb.from("kits").select("resume_md,cover_md,outreach_md,model,created_at").eq("job_id", jobId).maybeSingle();
      return data ? { resumeMd: data.resume_md, coverMd: data.cover_md, outreachMd: data.outreach_md, model: data.model, createdAt: data.created_at } : null;
    },

    async saveContact(c: Contact, model) {
      await sb.from("contacts").upsert({
        job_id: c.jobId, user_id: uid, company: c.company, person_name: c.personName,
        person_title: c.personTitle, emails: c.emails, links: c.links,
        source: c.source, confidence: c.confidence, model, created_at: new Date().toISOString(),
      }, { onConflict: "job_id" });
    },

    async getContact(jobId): Promise<Contact | null> {
      const { data } = await sb.from("contacts").select("job_id,company,person_name,person_title,emails,links,source,confidence").eq("job_id", jobId).maybeSingle();
      if (!data) return null;
      return {
        jobId: data.job_id, company: data.company, personName: data.person_name,
        personTitle: data.person_title, emails: data.emails ?? [], links: data.links ?? [],
        source: data.source, confidence: data.confidence,
      };
    },
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: errors ONLY in the old `db.ts`/`server-db.ts`/routes that still use the sync interface (fixed in Task 5). `data.ts` itself compiles. If `data.ts` has its own errors, fix them now.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data.ts src/lib/types.ts
git commit -m "s0: async user-scoped supabase data layer"
```

---

### Task 5: Cut routes & consumers over to the async data layer

**Files:**
- Modify: `src/lib/guard.ts`, every file under `src/app/api/*`, the pages `src/app/page.tsx`, `src/app/pipeline/page.tsx`, `src/app/analytics/page.tsx`, `src/app/profile/page.tsx`, `src/app/kit/[jobId]/page.tsx`, `src/app/setup/page.tsx`
- Modify: `src/lib/scrape.ts`, `src/lib/match.ts`, `src/lib/tailor.ts` (add `await` at the `Db` call sites only)
- Delete: `src/lib/db.ts`, `src/lib/server-db.ts`

**Interfaces:**
- Consumes: `getData()` from `@/lib/data`, `getUser()` from `@/lib/supabase/server`.
- Produces: an app with no remaining references to `createDb`/`server-db`; all `Db` calls awaited.

- [ ] **Step 1: Adapt the pure consumers to async `Db`**

In `scrape.ts`, `match.ts`, `tailor.ts`, prefix every `db.<method>(...)` call with `await` (they are already inside `async` functions). No other logic changes. Example in `scrape.ts`: `const n = await db.upsertJobs(jobs);`. Run `./node_modules/.bin/tsc --noEmit` and fix each flagged call site until only route/page errors remain.

- [ ] **Step 2: Rewrite `guard.ts` async**

```ts
import { redirect } from "next/navigation";
import { getData } from "./data";

export async function requireProfile() {
  const p = await getData().then((d) => d.getProfile());
  if (!p || !p.resumeText.trim()) redirect("/setup");
  return p;
}
```

- [ ] **Step 3: Port the API routes**

For each route under `src/app/api/*`, replace `import { db } from "@/lib/server-db"` with `import { getData } from "@/lib/data"`, get `const data = await getData();` at the top of the handler, and `await` every call. For pipeline routes that call Gemini, build the client from the user's BYOK key (Task 6 provides `getUserGeminiKey()`); until Task 6 lands, keep `geminiClient()` reading the env key so the app stays runnable. Example — `src/app/api/jobs/route.ts` GET body becomes:
```ts
const data = await getData();
return NextResponse.json({ jobs: await data.listJobs(f) });
```
and PATCH awaits `data.setStatus/markSeen/setStarred`.

- [ ] **Step 4: Port the pages**

Each Server Component page: replace `db()` with `const data = await getData();` and `await` calls; `requireProfile()` calls become `await requireProfile()`. The client components (`feed.tsx`, `board.tsx`, `kit-view.tsx`) are unchanged — they already talk to the API routes, not the DB.

- [ ] **Step 5: Delete the SQLite layer**

```bash
git rm src/lib/db.ts src/lib/server-db.ts
```

- [ ] **Step 6: Typecheck + build**

Run: `./node_modules/.bin/tsc --noEmit` → exit 0.
Run: `./node_modules/.bin/next build` → compiles (dynamic routes won't execute DB at build).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "s0: cut routes, pages, consumers, guard over to async data layer; drop sqlite"
```

---

### Task 6: BYOK Gemini key — Vault storage + server retrieval + settings endpoint

**Files:**
- Create: `supabase/migrations/0002_byok.sql`
- Create: `src/lib/secrets.ts`, `src/app/api/key/route.ts`
- Modify: pipeline routes (`api/refresh`, `api/match`, `api/match/deep`, `api/kit`, `api/contact`) to use the user's key

**Interfaces:**
- Produces:
  - SQL RPCs `set_gemini_key(p_key text)` and `get_gemini_key()` (both `security definer`), storing/reading the key in Vault keyed by the caller's `auth.uid()`, and `has_gemini_key()` returning boolean.
  - `setUserGeminiKey(key: string): Promise<void>`, `getUserGeminiKey(): Promise<string | null>` (server), `hasUserGeminiKey(): Promise<boolean>` in `src/lib/secrets.ts`.
  - `POST /api/key` (save), `GET /api/key` (returns `{ set: boolean }` only — never the key).

- [ ] **Step 1: Write `supabase/migrations/0002_byok.sql`**

```sql
-- Per-user Gemini key stored in Vault. RPCs run as definer and key on auth.uid().
create extension if not exists supabase_vault cascade;

create or replace function public.set_gemini_key(p_key text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare secret_name text := 'gemini_key_' || auth.uid();
begin
  if exists (select 1 from vault.secrets where name = secret_name) then
    perform vault.update_secret((select id from vault.secrets where name = secret_name), p_key);
  else
    perform vault.create_secret(p_key, secret_name);
  end if;
end $$;

create or replace function public.get_gemini_key()
returns text language plpgsql security definer set search_path = public, vault as $$
declare secret_name text := 'gemini_key_' || auth.uid(); k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = secret_name;
  return k;
end $$;

create or replace function public.has_gemini_key()
returns boolean language plpgsql security definer set search_path = public, vault as $$
begin
  return exists (select 1 from vault.secrets where name = 'gemini_key_' || auth.uid());
end $$;

revoke all on function public.get_gemini_key() from anon, authenticated;
-- get_gemini_key is server/service-only; set_/has_ are callable by the authed user
grant execute on function public.set_gemini_key(text), public.has_gemini_key() to authenticated;
```

Apply: `./node_modules/.bin/supabase db reset` → clean.

- [ ] **Step 2: `src/lib/secrets.ts`**

```ts
import { createServerClient } from "./supabase/server";
import { createServiceClient } from "./supabase/service";

export async function setUserGeminiKey(key: string): Promise<void> {
  const sb = await createServerClient();
  const { error } = await sb.rpc("set_gemini_key", { p_key: key });
  if (error) throw error;
}

export async function hasUserGeminiKey(): Promise<boolean> {
  const sb = await createServerClient();
  const { data, error } = await sb.rpc("has_gemini_key");
  if (error) throw error;
  return !!data;
}

// Server-only: retrieve the decrypted key for the CURRENT user via the service client,
// scoped explicitly by user id (get_gemini_key keys on auth.uid() when called with the
// user's JWT; for service-context cron, pass the uid form — see Task 7).
export async function getUserGeminiKey(): Promise<string | null> {
  const sb = await createServerClient();
  const { data, error } = await sb.rpc("get_gemini_key");
  if (error) throw error;
  return (data as string | null) ?? null;
}
```
Note: `get_gemini_key` was revoked from `authenticated`; to let the user's own server request read it for pipeline calls, instead grant execute to `authenticated` as well (the function only ever returns the caller's own key because it keys on `auth.uid()`). Adjust the migration's final `revoke`/`grant` so `get_gemini_key` is granted to `authenticated` — it is safe because it is self-scoped. (Keep service-role access for cron.)

- [ ] **Step 3: `src/app/api/key/route.ts`**

```ts
import { NextResponse } from "next/server";
import { setUserGeminiKey, hasUserGeminiKey } from "@/lib/secrets";

export async function GET() {
  return NextResponse.json({ set: await hasUserGeminiKey() });
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const key = String(body?.key ?? "").trim();
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  await setUserGeminiKey(key);
  return NextResponse.json({ ok: true, set: true });
}
```

- [ ] **Step 4: Use the user's key in the pipeline**

In each pipeline route, build the Gemini client from the user's key and fail clearly if absent:
```ts
import { getUserGeminiKey } from "@/lib/secrets";
import { geminiClient } from "@/lib/match";
// ...
const key = await getUserGeminiKey();
if (!key) return NextResponse.json({ error: "add your Gemini key in Settings" }, { status: 400 });
const client = geminiClient(key);
```
Apply to `api/match`, `api/match/deep`, `api/kit`, `api/contact`, and the match half of `api/refresh`.

- [ ] **Step 5: Typecheck + commit**

Run: `./node_modules/.bin/tsc --noEmit` → exit 0.
```bash
git add supabase/migrations/0002_byok.sql src/lib/secrets.ts src/app/api/key/route.ts src/app/api
git commit -m "s0: BYOK gemini key via supabase vault + per-user pipeline key"
```

---

### Task 7: Decoupled pipeline — runs table, batched match, polling, cron

**Files:**
- Create: `src/lib/runs.ts`, `src/app/api/runs/[id]/route.ts`, `src/app/api/cron/refresh/route.ts`
- Modify: `src/app/api/refresh/route.ts`, `src/app/api/match/route.ts`, `vercel.json`

**Interfaces:**
- Consumes: `getData()`, `getUserGeminiKey()`, `runScrape`, `matchNew`, `geminiClient`, `createServiceClient`.
- Produces:
  - `createRun(sb, userId, kind)`, `updateRun(sb, id, patch)`, `getRun(sb, id)` in `src/lib/runs.ts`.
  - `POST /api/refresh` → fast scrape + create `runs` row, returns `{ runId }`.
  - `POST /api/match` → scores the next batch for the user, updates the run, returns `{ done, scored }`.
  - `GET /api/runs/:id` → run progress.
  - `GET /api/cron/refresh` (service-role, header-guarded) → daily per-user refresh.

- [ ] **Step 1: `src/lib/runs.ts`** — thin helpers around the `runs` table (insert running row, patch progress/status/finished_at, select by id). Provide complete CRUD using a passed Supabase client. (Insert sets `user_id`; select/patch rely on RLS for the user path, service client for cron.)

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createRun(sb: SupabaseClient, userId: string, kind: "scrape" | "match" | "refresh") {
  const { data, error } = await sb.from("runs").insert({ user_id: userId, kind }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function updateRun(sb: SupabaseClient, id: string, patch: Record<string, unknown>) {
  await sb.from("runs").update(patch).eq("id", id);
}
export async function getRun(sb: SupabaseClient, id: string) {
  const { data } = await sb.from("runs").select("*").eq("id", id).maybeSingle();
  return data;
}
```

- [ ] **Step 2: Rewrite `api/refresh` to scrape-fast + create run**

```ts
import { NextResponse } from "next/server";
import { getData } from "@/lib/data";
import { getUser } from "@/lib/supabase/server";
import { createServerClient } from "@/lib/supabase/server";
import { runScrape } from "@/lib/scrape";
import { createRun, updateRun } from "@/lib/runs";

export const maxDuration = 60;

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const data = await getData();
  const sb = await createServerClient();
  const runId = await createRun(sb, user.id, "refresh");
  const scrape = await runScrape(data);
  const fetched = scrape.reduce((n, r) => n + r.fetched, 0);
  const inserted = scrape.reduce((n, r) => n + r.inserted, 0);
  await updateRun(sb, runId, { fetched, inserted, report: scrape });
  return NextResponse.json({ runId, scrape });
}
```

- [ ] **Step 3: Rewrite `api/match` to score one bounded batch and advance the run**

Accept `{ runId }`; load up to N (e.g. 20) unscored jobs; if none, mark the run `done` and return `{ done: true }`; else score them with the user's key via `matchNew` (or a batch-limited variant), bump `scored`, return `{ done: false, scored }`. Build the Gemini client from `getUserGeminiKey()` and 400 if missing. Keep `maxDuration = 60`.

- [ ] **Step 4: `api/runs/[id]` GET** — returns the run row (RLS ensures it's the caller's). Used by the dashboard to poll.

```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getRun } from "@/lib/runs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerClient();
  const run = await getRun(sb, id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(run);
}
```

- [ ] **Step 5: Wire the feed to poll**

In `feed.tsx` `handleRefresh`, after `POST /api/refresh` returns `{ runId }`, loop: `POST /api/match {runId}` then `GET /api/runs/:id` until `done`, updating a small progress line; then `window.location.reload()`. (UI-only change; no behavior contract change beyond progress display.)

- [ ] **Step 6: Cron endpoint + `vercel.json`**

`src/app/api/cron/refresh/route.ts`: guard on a `CRON_SECRET` header; use `createServiceClient()`; for each profile with `has_gemini_key()` true, run scrape + one match batch using that user's key (fetched server-side). `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/refresh", "schedule": "0 6 * * *" }] }
```
Add `/api/cron` to the middleware `PUBLIC_PATHS` (it authenticates via `CRON_SECRET`, not a session).

- [ ] **Step 7: Typecheck + commit**

Run: `./node_modules/.bin/tsc --noEmit` → exit 0.
```bash
git add src/lib/runs.ts src/app/api/runs src/app/api/cron src/app/api/refresh src/app/api/match src/app/feed.tsx src/middleware.ts vercel.json
git commit -m "s0: decoupled pipeline — runs table, batched match, polling, daily cron"
```

---

### Task 8: Data-layer + RLS + BYOK tests; consumer-test adaptation; deploy notes

**Files:**
- Create: `src/lib/data.test.ts`, `test/supabase-harness.ts`, `docs/DEPLOY.md`
- Modify: `src/lib/scrape.test.ts`, `src/lib/match.test.ts` (async stubs)
- Delete: `src/lib/db.test.ts`

**Interfaces:**
- Consumes: a local Supabase Postgres (`supabase start`) with migrations applied.
- Produces: tests proving CRUD round-trips and **RLS isolation** (user A cannot read user B's jobs), a BYOK round-trip test, and adapted consumer tests.

- [ ] **Step 1: Test harness `test/supabase-harness.ts`**

A helper that connects two service-role clients impersonating two seeded users (create users via the admin API `auth.admin.createUser`), returning per-user authed clients for assertions. Skips (not fails) the suite if `NEXT_PUBLIC_SUPABASE_URL` is unset, so CI without Supabase still passes the pure tests.

- [ ] **Step 2: RLS isolation test (write first, run, see it pass against the real schema)**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { twoUsers } from "../test/supabase-harness";

describe.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL)("RLS isolation", () => {
  it("user A cannot see user B's jobs", async () => {
    const { a, b } = await twoUsers();
    await a.from("jobs").insert({ user_id: a.uid, dedupe_key: "k", source: "s", company: "C", title: "T", url: "u" });
    const { data: bSees } = await b.client.from("jobs").select("id");
    expect(bSees ?? []).toHaveLength(0);
  });
});
```
Run: `./node_modules/.bin/vitest run src/lib/data.test.ts` → PASS (or SKIP if no local Supabase). When run with `supabase start` active + env set, it PASSES.

- [ ] **Step 3: CRUD + BYOK round-trip tests** — exercise `getData()` against a seeded authed context: upsert jobs (idempotent re-upsert returns 0), listJobs filters/order, saveMatch→listJobs shows score, profile save/get, kit save/get; and `set_gemini_key`→`has_gemini_key` true while a client-shaped `GET /api/key` never exposes the value.

- [ ] **Step 4: Adapt consumer tests** — in `scrape.test.ts`/`match.test.ts`, make the in-memory `Db` stub methods `async` (return `Promise.resolve(...)`) to match the new interface. Run `./node_modules/.bin/vitest run` → all green.

- [ ] **Step 5: `docs/DEPLOY.md`** — exact steps: create Supabase cloud project, set the three env vars locally + in Vercel, `supabase link` + `supabase db push`, enable Google OAuth in Supabase Auth, set `CRON_SECRET`, deploy to Vercel, verify cron.

- [ ] **Step 6: Full suite + typecheck + commit**

Run: `./node_modules/.bin/vitest run` → green; `./node_modules/.bin/tsc --noEmit` → exit 0.
```bash
git add -A
git commit -m "s0: data-layer + RLS + BYOK tests, async consumer stubs, deploy guide"
```

---

## Self-Review

**Spec coverage (S0 spec → tasks):**
- Supabase project + CLI + env → Task 1. ✓
- Schema + RLS + profile trigger + indexes + `runs` → Task 2. ✓
- BYOK via Vault (+fallback noted) → Task 6. ✓
- Auth (`@supabase/ssr`, middleware, protected routes, email + Google) → Task 3. ✓
- Async user-scoped data layer (every `Db` method) → Task 4. ✓
- Cutover of routes/pages/consumers; remove `server-db`/`db` → Task 5. ✓
- Decoupled pipeline (runs, batched match, polling, cron) → Task 7. ✓
- Testing strategy (pure stay green, RLS isolation, BYOK, async stubs, deploy) → Task 8. ✓
- Branch `saas-foundation`, clean cutover, secrets in env → Global Constraints + Task 1. ✓

**Placeholder scan:** Tasks 5/7 Steps describe mechanical edits (await-ing calls, per-route key wiring) rather than re-pasting every file — these are repetitive applications of a pattern shown in full once, with exact file lists, not vague "handle the rest". The data layer (Task 4) and all SQL/auth/BYOK code are given in full. No "TBD"/"add error handling".

**Type consistency:** The async `Db` interface in Task 4 is the contract Tasks 5/7/8 consume; `getData(): Promise<Db>`, `geminiClient(key)`, `getUserGeminiKey(): Promise<string|null>`, `createServerClient(): Promise<SupabaseClient>`, run helpers `(sb, ...)` — names used consistently across tasks. `JobRow`/`Contact`/`Kit` shapes unchanged from the existing `types.ts`, so the pure modules keep compiling.

**Known external dependencies (call out, not gaps):** Tasks 2/6/8 require a running Supabase (local `supabase start` for tests; a cloud project for deploy) and, for OAuth, Google credentials in Supabase Auth. These are environment setup, surfaced in `docs/DEPLOY.md` and the spec's prerequisites — not code gaps.
