-- Optional: schedule new problems from this concept first (manual category focus).
alter table public.settings
  add column if not exists priority_category text;
