-- Hilo B2B, step 9: Reports, and the loneliness check (UCLA-3) that feeds it.
--
-- UCLA-3 (Hughes et al. 2004): three questions answered with her carer, at sign-up and then monthly.
-- Each answer 1 = hardly ever, 2 = some of the time, 3 = often; the score is their sum, 3 (least lonely) to 9.
-- It is what she says, asked by a person: Hilo never guesses feelings from her talks (GDPR, AI Act).
--
-- staff_report(org, from, to): every number on the Reports page for a period of her local days, as totals
-- only (never talks, audio or stories). Alerts aren't stored (staff_signals works them out live), so the
-- report works them out again for each past day with the same rules, as they stood that morning:
--   no_talk    2+ days since her last talk before that day (or since she joined)
--   pills      a dose due the day before not confirmed
--   no_family  5+ days since the last family call (or since she joined), only if she has family in Hilo
-- Only seniors whose phone is paired today get alerts (when it was paired isn't recorded). "Solved the same
-- day" = a Done on Today for her that same day.

-- ── Loneliness checks ────────────────────────────────────────────────────

create table public.loneliness_checks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  person_id     uuid not null references public.people (id) on delete cascade,
  -- the staff member who asked; kept as null if their account is deleted
  user_id       uuid references auth.users (id) on delete set null,
  -- "How often do you feel that you lack companionship?"
  companionship smallint not null check (companionship between 1 and 3),
  -- "How often do you feel left out?"
  left_out      smallint not null check (left_out between 1 and 3),
  -- "How often do you feel isolated from others?"
  isolated      smallint not null check (isolated between 1 and 3),
  score         smallint generated always as (companionship + left_out + isolated) stored,
  taken_at      timestamptz not null default now()
);

create index loneliness_checks_person_idx on public.loneliness_checks (person_id, taken_at);
create index loneliness_checks_org_idx on public.loneliness_checks (org_id, taken_at);

alter table public.loneliness_checks enable row level security;

-- Read: the organisation. No write policies: only the functions below write.
create policy "staff read their loneliness checks" on public.loneliness_checks
  for select to authenticated using (public.is_org_member(org_id));

create function public.staff_add_loneliness(person uuid, companionship int, left_out int, isolated int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid uuid;
  new_id uuid;
begin
  select f.org_id into oid
  from public.people p
  join public.families f on f.id = p.family_id
  join public.org_members m on m.org_id = f.org_id and m.user_id = auth.uid()
  where p.id = person and p.role = 'senior';
  if oid is null then
    raise exception 'Not your organisation';
  end if;
  insert into public.loneliness_checks (org_id, person_id, user_id, companionship, left_out, isolated)
  values (oid, person, auth.uid(), companionship, left_out, isolated)
  returning id into new_id;
  return new_id;
end;
$$;

-- A mistaken answer: only your own, and only the same day
create function public.staff_delete_loneliness(check_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.loneliness_checks
  where id = check_id and user_id = auth.uid() and taken_at > now() - interval '18 hours';
$$;

revoke all on function public.staff_add_loneliness(uuid, int, int, int) from public, anon;
revoke all on function public.staff_delete_loneliness(uuid) from public, anon;
grant execute on function public.staff_add_loneliness(uuid, int, int, int) to authenticated;
grant execute on function public.staff_delete_loneliness(uuid) to authenticated;

-- ── Report ───────────────────────────────────────────────────────────────

create function public.staff_report(org uuid, from_day date, to_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_org_member(org) then
    raise exception 'Not your organisation';
  end if;
  if to_day < from_day or to_day - from_day > 400 then
    raise exception 'Bad period';
  end if;

  with seniors as (
    select p.id, p.timezone as tz, p.user_id is not null as paired, f.carer_id,
           (p.created_at at time zone p.timezone)::date as joined,
           (now() at time zone p.timezone)::date as today,
           (now() at time zone p.timezone)::time as now_time,
           exists (select 1 from public.people m where m.family_id = p.family_id and m.role = 'member') as has_family
    from public.people p
    join public.families f on f.id = p.family_id
    where p.role = 'senior' and f.org_id = org
  ),

  -- Each senior's days in the period: from when she joined, up to today
  days as (
    select s.*, g.d::date as day
    from seniors s
    cross join lateral generate_series(greatest(from_day, s.joined), least(to_day, s.today), interval '1 day') as g (d)
  ),

  talk_days as (
    select distinct t.person_id, (t.started_at at time zone s.tz)::date as day
    from public.talk_sessions t
    join seniors s on s.id = t.person_id
  ),

  -- Doses due each day of the period (today only up to now), and whether each was confirmed
  doses as (
    select d.id, d.day, (e.id is not null) as taken
    from days d
    join public.medications m on m.person_id = d.id and m.active
    cross join lateral unnest(m.times) as dose (dose_time)
    left join public.medication_events e
      on e.medication_id = m.id and e.scheduled_date = d.day and e.scheduled_time = dose.dose_time and e.status = 'taken'
    where extract(isodow from d.day)::smallint = any (m.weekdays)
      and (m.created_at at time zone d.tz)::date <= d.day
      and (d.day < d.today or dose.dose_time <= d.now_time)
  ),

  -- Alerts as Today showed them on the morning of each day (paired phones only)
  alerts as (
    select d.id, d.carer_id, d.day, 'no_talk' as kind
    from days d
    where d.paired
      and d.day - coalesce((select max(td.day) from talk_days td where td.person_id = d.id and td.day < d.day), d.joined) >= 2
    union all
    select d.id, d.carer_id, d.day, 'pills'
    from days d
    where d.paired and d.day > d.joined
      and exists (
        select 1
        from public.medications m
        cross join lateral unnest(m.times) as dose (dose_time)
        where m.person_id = d.id and m.active
          and extract(isodow from d.day - 1)::smallint = any (m.weekdays)
          -- as on Today: a pill added on day d wasn't due the day before
          and (m.created_at at time zone d.tz)::date < d.day
          and not exists (
            select 1 from public.medication_events e
            where e.medication_id = m.id and e.scheduled_date = d.day - 1
              and e.scheduled_time = dose.dose_time and e.status = 'taken'
          )
      )
    union all
    select d.id, d.carer_id, d.day, 'no_family'
    from days d
    where d.paired and d.has_family
      and d.day - coalesce(
        (select max((c.called_at at time zone d.tz)::date) from public.family_calls c
         where c.senior_id = d.id and (c.called_at at time zone d.tz)::date < d.day),
        d.joined) >= 5
  ),

  solved as (
    select a.*, exists (
      select 1 from public.staff_actions sa
      join seniors s on s.id = sa.person_id
      where sa.person_id = a.id and (sa.created_at at time zone s.tz)::date = a.day
    ) as same_day
    from alerts a
  ),

  -- Mondays of the weeks in the period, for the engagement chart
  weeks as (
    select w::date as monday
    from generate_series(date_trunc('week', from_day::timestamp), to_day::timestamp, interval '1 week') as w
  ),

  week_rows as (
    select wk.monday,
           count(*) as people,
           count(*) filter (where (
             select count(*) from talk_days td
             where td.person_id = s.id and td.day between wk.monday and wk.monday + 6
           ) >= 4) as engaged,
           bool_or(wk.monday + 6 > s.today) as partial
    from weeks wk
    -- weeks that have started, for people who had joined by their Monday
    join seniors s on s.paired and s.joined <= wk.monday and wk.monday <= s.today
    group by wk.monday
  ),

  checks as (
    select c.person_id, c.score, c.taken_at,
           row_number() over (partition by c.person_id order by c.taken_at) as first_n,
           row_number() over (partition by c.person_id order by c.taken_at desc) as last_n,
           count(*) over (partition by c.person_id) as n
    from public.loneliness_checks c
    join seniors s on s.id = c.person_id
    where (c.taken_at at time zone s.tz)::date <= to_day
  )

  select jsonb_build_object(
    'first_day', (select min(joined) from seniors),
    'people', (select count(*) from seniors where joined <= to_day),
    'joined', (select count(*) from seniors where joined between from_day and to_day),
    'paired', (select count(*) from seniors where joined <= to_day and paired),
    -- pooled over paired seniors: days with a talk / days in the period, per 7 days
    'talk_days', (select count(*) from days d join talk_days td on td.person_id = d.id and td.day = d.day where d.paired),
    'paired_days', (select count(*) from days where paired),
    'doses_due', (select count(*) from doses),
    'doses_taken', (select count(*) from doses where taken),
    'alerts', (select count(*) from solved),
    'alerts_same_day', (select count(*) from solved where same_day),
    'alerts_by_kind', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) as n from solved group by kind) k), '{}'),
    'weeks', coalesce((select jsonb_agg(jsonb_build_object('monday', monday, 'people', people, 'engaged', engaged, 'partial', partial)
                                        order by monday) from week_rows), '[]'),
    'carers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', m.display_name,
        'people', (select count(*) from seniors s where s.carer_id = m.user_id),
        'alerts', (select count(*) from solved x where x.carer_id = m.user_id),
        'same_day', (select count(*) from solved x where x.carer_id = m.user_id and x.same_day),
        'calls', (select count(*) from public.staff_actions sa
                  join seniors s on s.id = sa.person_id
                  where sa.user_id = m.user_id and sa.org_id = org
                    and (sa.created_at at time zone s.tz)::date between from_day and to_day)
      ) order by m.display_name)
      from public.org_members m where m.org_id = org
    ), '[]'),
    'loneliness', jsonb_build_object(
      'people', (select count(distinct person_id) from checks),
      'followed', (select count(distinct person_id) from checks where n >= 2),
      'start', (select round(avg(score), 1) from checks where first_n = 1 and n >= 2),
      'now', (select round(avg(score), 1) from checks where last_n = 1 and n >= 2),
      'first_only', (select round(avg(score), 1) from checks where first_n = 1)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.staff_report(uuid, date, date) from public, anon;
grant execute on function public.staff_report(uuid, date, date) to authenticated;
