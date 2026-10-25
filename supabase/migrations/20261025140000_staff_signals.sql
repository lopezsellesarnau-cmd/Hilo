-- Hilo B2B, step 4: the alerts on the staff Today page ("who to call").
-- "The AI talks, code decides": every alert is a plain rule over dates and counts, never over what she said.
-- Worked out live when the page asks (no nightly job yet): small organisations, and a call made in the morning
-- takes her off the list as soon as she talks or the family calls. Rules that need new data come later:
-- "not well" 3 times in a week (needs the 3-button check-in), shorter talks, Hilo told her to call 112.
--
-- One row per alert:
--   no_talk    value = whole days since her last talk (or since she joined, if she never talked); from 2 days
--   pills      value = doses not confirmed yesterday, total = doses due yesterday; from 1 dose
--   no_family  value = whole days since the last family call; from 5 days, only if she has family in Hilo
-- Days count in her own timezone. A phone that isn't paired yet gets no alerts: there is nothing to miss.

create function public.staff_signals()
returns table (person_id uuid, kind text, value int, total int, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with seniors as (
    select p.id, p.family_id, p.created_at, p.timezone as tz,
           (now() at time zone p.timezone)::date as today
    from public.people p
    where p.role = 'senior'
      and p.user_id is not null
      and public.is_org_staff_for_family(p.family_id)
  ),

  talks as (
    select s.id, s.today, s.tz, coalesce(max(t.started_at), s.created_at) as last_at
    from seniors s
    left join public.talk_sessions t on t.person_id = s.id
    group by s.id, s.today, s.tz, s.created_at
  ),

  doses as (
    select s.id, m.id as medication_id, s.today - 1 as day, dose_time
    from seniors s
    join public.medications m on m.person_id = s.id and m.active
    cross join lateral unnest(m.times) as dose_time
    where extract(isodow from s.today - 1)::smallint = any (m.weekdays)
      -- a pill added today wasn't due yesterday
      and (m.created_at at time zone s.tz)::date < s.today
  ),

  family as (
    select s.id, s.today, s.tz, s.created_at,
           (select max(c.called_at) from public.family_calls c where c.senior_id = s.id) as last_at
    from seniors s
    where exists (
      select 1 from public.people m where m.family_id = s.family_id and m.role = 'member'
    )
  )

  select id, 'no_talk', (today - (last_at at time zone tz)::date), null::int, last_at
  from talks
  where today - (last_at at time zone tz)::date >= 2

  union all

  select d.id, 'pills', count(*) filter (where e.id is null)::int, count(*)::int, null::timestamptz
  from doses d
  left join public.medication_events e
    on e.medication_id = d.medication_id
   and e.scheduled_date = d.day
   and e.scheduled_time = d.dose_time
   and e.status = 'taken'
  group by d.id
  having count(*) filter (where e.id is null) > 0

  union all

  select id, 'no_family', (today - (coalesce(last_at, created_at) at time zone tz)::date), null::int, last_at
  from family
  where today - (coalesce(last_at, created_at) at time zone tz)::date >= 5;
$$;

revoke all on function public.staff_signals() from public, anon;
grant execute on function public.staff_signals() to authenticated;
