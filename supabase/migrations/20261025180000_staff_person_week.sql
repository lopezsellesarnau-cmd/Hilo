-- Hilo B2B, step 6: the staff Person page. Her last 7 days as dates and counts only:
-- how many talks each day (never what was said), pills due and confirmed, and family calls.
-- Days are in her timezone. Today's pills count only doses whose time has already passed.

create function public.staff_person_week(person uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
  fid uuid;
  today date;
  result jsonb;
begin
  select p.timezone, p.family_id into tz, fid
  from public.people p
  where p.id = person and p.role = 'senior';
  if fid is null or not public.is_org_staff_for_family(fid) then
    raise exception 'Not your organisation';
  end if;
  today := (now() at time zone tz)::date;

  with days as (
    select d::date as day from generate_series(today - 6, today, interval '1 day') d
  ),
  talks as (
    select (t.started_at at time zone tz)::date as day, count(*)::int as n
    from public.talk_sessions t
    where t.person_id = person and t.started_at >= (today - 7)::timestamp at time zone tz
    group by 1
  ),
  doses as (
    select d.day, m.id as medication_id, dose_time
    from days d
    join public.medications m on m.person_id = person and m.active
    cross join lateral unnest(m.times) as dose_time
    where extract(isodow from d.day)::smallint = any (m.weekdays)
      and (m.created_at at time zone tz)::date <= d.day
      and (d.day < today or dose_time <= (now() at time zone tz)::time)
  ),
  pills as (
    select x.day, count(*)::int as due, count(e.id)::int as taken
    from doses x
    left join public.medication_events e
      on e.medication_id = x.medication_id
     and e.scheduled_date = x.day
     and e.scheduled_time = x.dose_time
     and e.status = 'taken'
    group by x.day
  ),
  calls as (
    select (c.called_at at time zone tz)::date as day, count(*)::int as n
    from public.family_calls c
    where c.senior_id = person and c.called_at >= (today - 7)::timestamp at time zone tz
    group by 1
  )
  select jsonb_build_object(
    'days', (
      select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'talks', coalesce(t.n, 0),
        'due', coalesce(p.due, 0),
        'taken', coalesce(p.taken, 0),
        'calls', coalesce(c.n, 0)
      ) order by d.day)
      from days d
      left join talks t on t.day = d.day
      left join pills p on p.day = d.day
      left join calls c on c.day = d.day
    ),
    'last_talk', (select max(t.started_at) from public.talk_sessions t where t.person_id = person),
    'last_call', (select max(c.called_at) from public.family_calls c where c.senior_id = person)
  ) into result;

  return result;
end;
$$;

revoke all on function public.staff_person_week(uuid) from public, anon;
grant execute on function public.staff_person_week(uuid) to authenticated;
