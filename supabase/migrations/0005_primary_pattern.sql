-- Single canonical learning concept per problem, for future grouped scheduling.
-- Kept separate from the patterns[] tag set, which stays the source for search.
alter table public.problems
  add column if not exists primary_pattern text;
