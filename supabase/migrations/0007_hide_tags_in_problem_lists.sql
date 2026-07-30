-- Optional compact display for queue and problem-list cards.
alter table public.settings
  add column if not exists hide_tags_in_problem_lists boolean not null default false;
