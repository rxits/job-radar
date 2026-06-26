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
