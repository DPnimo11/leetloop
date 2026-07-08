-- Keep the memory-model date separate from the capacity-leveled plan date.
alter table public.problems
  add column if not exists ideal_review_at timestamptz;

-- Existing review dates were ideal dates before finite-capacity leveling was
-- introduced. New problems use next_review_at only as their planned start.
update public.problems
set ideal_review_at = next_review_at
where status <> 'new'
  and ideal_review_at is null;

create index if not exists problems_user_ideal_review_idx
  on public.problems (user_id, ideal_review_at);
