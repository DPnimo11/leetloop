-- Reserve part of each daily plan for new problems when unstarted work exists.
alter table public.settings
  add column if not exists reserved_new_starts_per_day integer not null default 1;
