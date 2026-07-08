-- Temporary snooze and indefinite pause are availability concerns, separate
-- from a problem's learning/review status.
alter table public.problems
  add column if not exists snoozed_at timestamptz,
  add column if not exists snoozed_until timestamptz,
  add column if not exists plan_slot_consumed_on text;

create index if not exists problems_user_snoozed_until_idx
  on public.problems (user_id, snoozed_until);
