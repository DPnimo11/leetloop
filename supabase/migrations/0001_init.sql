-- LeetLoop cloud schema (Milestone B)
-- Apply via Supabase Dashboard -> SQL Editor (run the whole file once).
--
-- Tables: profiles, problems, attempts, settings.
-- All user-owned tables carry user_id and are protected by Row Level Security
-- so each row is only visible/writable by its owner (auth.uid() = user_id).

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (reserved for future profile fields).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already existed (e.g. Milestone A sign-ins).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- problems: mirrors the app's Problem type. Keeps the app-generated string id
-- as the primary key so existing ids survive JSON import.
-- ---------------------------------------------------------------------------
create table if not exists public.problems (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null,
  url              text not null,
  platform         text not null check (platform in ('LeetCode', 'NeetCode', 'Other')),
  difficulty       text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  patterns         text[] not null default '{}',
  status           text not null check (status in ('new', 'learning', 'reviewing', 'retired')),
  notes            text,
  last_attempted_at timestamptz,
  next_review_at   timestamptz,
  review_count     integer not null default 0,
  clean_streak     integer not null default 0,
  last_result      text check (last_result in ('solved_clean', 'solved_buggy', 'needed_hint', 'looked_solution', 'failed_reconstruct')),
  leetcode_slug    text,
  source_set_slugs text[],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists problems_user_id_idx on public.problems (user_id);
create index if not exists problems_user_next_review_idx on public.problems (user_id, next_review_at);

alter table public.problems enable row level security;

create policy "problems_select_own" on public.problems
  for select using (auth.uid() = user_id);
create policy "problems_insert_own" on public.problems
  for insert with check (auth.uid() = user_id);
create policy "problems_update_own" on public.problems
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "problems_delete_own" on public.problems
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- attempts: mirrors the app's Attempt type.
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  problem_id       text not null references public.problems (id) on delete cascade,
  attempted_at     timestamptz not null,
  result           text not null check (result in ('solved_clean', 'solved_buggy', 'needed_hint', 'looked_solution', 'failed_reconstruct')),
  time_minutes     integer,
  note             text,
  planned_for_date text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index if not exists attempts_user_id_idx on public.attempts (user_id);
create index if not exists attempts_problem_id_idx on public.attempts (problem_id);

alter table public.attempts enable row level security;

create policy "attempts_select_own" on public.attempts
  for select using (auth.uid() = user_id);
create policy "attempts_insert_own" on public.attempts
  for insert with check (auth.uid() = user_id);
create policy "attempts_update_own" on public.attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts_delete_own" on public.attempts
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- settings: one row per user.
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  daily_target        integer not null default 5,
  extra_daily_capacity jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "settings_delete_own" on public.settings
  for delete using (auth.uid() = user_id);
