-- Daily talk time for a senior, e.g. 10:00.
-- Local time in people.timezone, so it stays at 10:00 when the clocks change.
-- Null for family members and for seniors who have not chosen one yet.
alter table public.people add column talk_time time;
