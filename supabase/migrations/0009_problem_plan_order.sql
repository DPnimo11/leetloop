-- Preserve a new-start card's position when it is swapped inside Today's queue.
alter table public.problems
  add column if not exists plan_order integer check (plan_order >= 0);
