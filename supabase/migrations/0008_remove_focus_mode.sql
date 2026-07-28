-- Focus mode was replaced by the manual priority category picker.
alter table public.settings
  drop column if exists focus_mode;
