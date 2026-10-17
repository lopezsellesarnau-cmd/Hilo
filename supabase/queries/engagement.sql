-- Hilo: engagement per senior, the number investors ask for.
-- Run in the SQL Editor (it reads everything: never expose it to the app).
-- A "real" talk is one where she answered at least once (more than Hilo's greeting).

with real_talks as (
  select s.person_id,
         s.started_at,
         (s.started_at at time zone p.timezone)::date as day,
         extract(epoch from (coalesce(s.ended_at, max(t.created_at)) - s.started_at)) / 60 as minutes
  from public.talk_sessions s
  join public.people p on p.id = s.person_id
  join public.turns t on t.session_id = s.id
  group by s.id, p.timezone
  having count(*) filter (where t.speaker = 'senior') > 0
),
days as (
  select person_id, day, sum(minutes) as minutes, count(*) as talks
  from real_talks
  group by person_id, day
),
per_senior as (
  select d.person_id,
         min(d.day) as first_day,
         count(*) as days_talked,
         -- days since her first talk, today included
         (current_date - min(d.day) + 1) as days_possible,
         round(avg(d.minutes)::numeric, 1) as avg_minutes_per_day,
         round(avg(d.talks)::numeric, 1) as avg_talks_per_day,
         -- of the days she talked, how often she talked again the next day
         round(100.0 * count(*) filter (where exists (
           select 1 from days n where n.person_id = d.person_id and n.day = d.day + 1
         )) / nullif(count(*) filter (where d.day < current_date), 0)) as came_back_next_day_pct,
         count(*) filter (where d.day > current_date - 7) as days_last_7
  from days d
  group by d.person_id
)
select p.display_name,
       ps.first_day,
       ps.days_talked,
       ps.days_possible,
       round(100.0 * ps.days_talked / ps.days_possible) as days_talked_pct,
       ps.days_last_7,
       ps.avg_minutes_per_day,
       ps.avg_talks_per_day,
       ps.came_back_next_day_pct
from per_senior ps
join public.people p on p.id = ps.person_id
order by ps.first_day;
