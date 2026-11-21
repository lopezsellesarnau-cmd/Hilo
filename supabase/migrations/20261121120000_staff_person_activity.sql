-- Hilo B2B: her last 12 weeks of talks on the person page (the activity grid), as counts only.
--
-- staff_person_activity(person): one row per day she answered Hilo, from the Monday 11 weeks ago to today
-- in her time zone, with how many times she answered. Never what she said. Same check as
-- staff_person_week (she belongs to the caller's organisation, second step done), and like it, staff
-- can't call it directly: staff_open_person adds it to what it already returns, so opening the page
-- is still logged once in staff_access_log.

create function public.staff_person_activity(person uuid)
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
  first_day date;
begin
  select p.timezone, p.family_id into tz, fid
  from public.people p
  where p.id = person and p.role = 'senior';
  if fid is null or not public.is_org_staff_for_family(fid) then
    raise exception 'Not your organisation';
  end if;
  today := (now() at time zone tz)::date;
  -- Monday of the week 11 weeks before this one: 12 full columns of Monday to Sunday
  first_day := today - (extract(isodow from today)::int - 1) - 7 * 11;

  return coalesce((
    select jsonb_agg(jsonb_build_object('day', x.day, 'answers', x.answers) order by x.day)
    from (
      select (t.started_at at time zone tz)::date as day, sum(t.answers)::int as answers
      from public.talk_sessions t
      where t.person_id = person
        and t.started_at >= first_day::timestamp at time zone tz
        and t.answers > 0
      group by 1
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.staff_person_activity(uuid) from public, anon, authenticated;

-- The person page: her week, plus the 12 weeks for the grid, logged once as before
create or replace function public.staff_open_person(person uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.staff_person_week(person) || jsonb_build_object('activity', public.staff_person_activity(person));
  perform public.log_staff_access(
    (select f.org_id from public.people p join public.families f on f.id = p.family_id where p.id = person),
    person,
    'person'
  );
  return result;
end;
$$;
