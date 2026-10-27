-- Hilo: "How are you?" on her Home, three buttons, once a day. It is what she says: Hilo never guesses
-- feelings from her talks (GDPR, AI Act). One answer per local day; she can change it the same day.
--   1 = good, 2 = so-so, 3 = bad
-- Her family reads the answers (a signal, like the pills). Staff read them only through the functions below.
-- Probably health data (GDPR art. 9): legal basis and consent before a real pilot, as with UCLA-3.
--
-- Staff: a new alert on Today, bad 3+ days of her last 7, and her answer per day on the Person page.

create table public.checkins (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  person_id    uuid not null,
  -- her local date when she answered
  day          date not null,
  feeling      smallint not null check (feeling between 1 and 3),
  answered_at  timestamptz not null default now(),
  unique (person_id, day),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

alter table public.checkins enable row level security;

-- Read: her and her family. No write policies: only i_feel writes.
create policy "family reads check-ins" on public.checkins
  for select to authenticated using (public.family_role(family_id) is not null);

create function public.i_feel(feeling int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.people;
begin
  if feeling not between 1 and 3 then
    raise exception 'Bad answer';
  end if;
  select * into me from public.people where user_id = auth.uid() and role = 'senior';
  if me.id is null then
    raise exception 'Not a senior';
  end if;
  insert into public.checkins (family_id, person_id, day, feeling)
  values (me.family_id, me.id, (now() at time zone me.timezone)::date, feeling)
  on conflict (person_id, day) do update set feeling = excluded.feeling, answered_at = now();
end;
$$;

revoke all on function public.i_feel(int) from public, anon;
grant execute on function public.i_feel(int) to authenticated;

-- ── Staff Today: same rules as before plus feels_bad ─────────────────────
--   feels_bad  value = days she answered "bad" in her last 7 (today included), total = 7; from 3 days

create or replace function public.staff_signals()
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
  where today - (coalesce(last_at, created_at) at time zone tz)::date >= 5

  union all

  select s.id, 'feels_bad', count(*)::int, 7, max(c.answered_at)
  from seniors s
  join public.checkins c on c.person_id = s.id and c.day between s.today - 6 and s.today and c.feeling = 3
  group by s.id
  having count(*) >= 3;
$$;

-- ── Staff Person: her answer each day (null = she didn't answer) ─────────

create or replace function public.staff_person_week(person uuid)
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
        'calls', coalesce(c.n, 0),
        'feeling', k.feeling
      ) order by d.day)
      from days d
      left join talks t on t.day = d.day
      left join pills p on p.day = d.day
      left join calls c on c.day = d.day
      left join public.checkins k on k.person_id = person and k.day = d.day
    ),
    'last_talk', (select max(t.started_at) from public.talk_sessions t where t.person_id = person),
    'last_call', (select max(c.called_at) from public.family_calls c where c.senior_id = person)
  ) into result;

  return result;
end;
$$;
