-- Focus mode groups new-problem introductions by primary concept
-- (largest category first) instead of plain oldest-added order.
alter table public.settings
  add column if not exists focus_mode boolean not null default false;
