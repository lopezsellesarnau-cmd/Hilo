-- Hilo B2B, step 8: the staff People page. One row per senior of the caller's organisation, as counts only
-- (never what was said): her carer, last talk and talks in the last 7 days, pills due and confirmed in the
-- last 7 days, family members and last family call. Pills are counted as in staff_person_week (her timezone,
-- today only up to now). Staff don't read people directly (see the organizations migration), hence a function.

create function public.staff_people_overview()
returns table (
  id uuid,
  display_name text,
  created_at timestamptz,
  paired boolean,
  carer_id uuid,
  family_members int,
  last_talk timestamptz,
  talks_7d int,
  pills_due_7d int,
  pills_taken_7d int,
  last_call timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.created_at,
    p.user_id is not null,
    f.carer_id,
    (select count(*)::int from public.people m where m.family_id = p.family_id and m.role = 'member'),
    (select max(t.started_at) from public.talk_sessions t where t.person_id = p.id),
    (select count(*)::int from public.talk_sessions t
     where t.person_id = p.id and t.started_at >= (lt.today - 6)::timestamp at time zone p.timezone),
    pills.due,
    pills.taken,
    (select max(c.called_at) from public.family_calls c where c.senior_id = p.id)
  from public.people p
  join public.families f on f.id = p.family_id
  join public.org_members om on om.org_id = f.org_id and om.user_id = auth.uid()
  cross join lateral (
    select (now() at time zone p.timezone)::date as today, (now() at time zone p.timezone)::time as now_time
  ) lt
  cross join lateral (
    select count(*)::int as due, count(e.id)::int as taken
    from generate_series(lt.today - 6, lt.today, interval '1 day') as g (d)
    join public.medications m on m.person_id = p.id and m.active
    cross join lateral unnest(m.times) as dose (dose_time)
    left join public.medication_events e
      on e.medication_id = m.id
     and e.scheduled_date = g.d::date
     and e.scheduled_time = dose.dose_time
     and e.status = 'taken'
    where extract(isodow from g.d)::smallint = any (m.weekdays)
      and (m.created_at at time zone p.timezone)::date <= g.d::date
      and (g.d::date < lt.today or dose.dose_time <= lt.now_time)
  ) pills
  where p.role = 'senior'
  order by p.display_name;
$$;

revoke all on function public.staff_people_overview() from public, anon;
grant execute on function public.staff_people_overview() to authenticated;
