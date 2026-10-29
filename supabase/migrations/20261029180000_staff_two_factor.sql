-- Hilo B2B, legal: two-factor sign-in (TOTP, a 6-digit code from an authenticator app) for every staff member.
-- Staff see health signals of vulnerable people, so a stolen email inbox must not be enough to get in.
--
-- Enforced here, not only in the web: Supabase marks a session 'aal2' once the second factor is verified,
-- and every staff check now asks for it. The two helpers (is_org_member, is_org_staff_for_family) cover the
-- RLS policies and most staff functions; the functions that join org_members themselves are redone below
-- with the same one-line check, word for word otherwise. Without aal2 a staff member sees and does nothing.
-- The one thing they can read with just the email code is their own org_members row, so the web knows to ask
-- for the second step (or to set it up the first time).

create function public.staff_mfa_ok()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

revoke all on function public.staff_mfa_ok() from public, anon;
grant execute on function public.staff_mfa_ok() to authenticated;

create policy "staff read their own membership" on public.org_members
  for select to authenticated using (user_id = auth.uid());

-- The access log: admins, after the second step too
drop policy "admins read their access log" on public.staff_access_log;
create policy "admins read their access log" on public.staff_access_log
  for select to authenticated
  using (public.staff_mfa_ok() and exists (
    select 1 from public.org_members m
    where m.org_id = staff_access_log.org_id and m.user_id = auth.uid() and m.role = 'admin'
  ));

-- ── The same functions, with the check ──────────────────────────────────

create or replace function public.is_org_member(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members
    where org_id = oid and user_id = auth.uid() and public.staff_mfa_ok()
  );
$$;

create or replace function public.is_org_staff_for_family(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    join public.org_members m on m.org_id = f.org_id
    where f.id = fid and m.user_id = auth.uid() and public.staff_mfa_ok()
  );
$$;

create or replace function public.staff_mark_done(person uuid, note text default null)
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
  join public.org_members m on m.org_id = f.org_id and m.user_id = auth.uid() and public.staff_mfa_ok()
  where p.id = person and p.role = 'senior';
  if oid is null then
    raise exception 'Not your organisation';
  end if;
  insert into public.staff_actions (org_id, person_id, user_id, note)
  values (oid, person, auth.uid(), nullif(btrim(note), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.staff_undo(action uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.staff_actions
  where id = action and user_id = auth.uid() and public.staff_mfa_ok() and created_at > now() - interval '18 hours';
$$;

create or replace function public.staff_people_overview()
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
  join public.org_members om on om.org_id = f.org_id and om.user_id = auth.uid() and public.staff_mfa_ok()
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

create or replace function public.staff_add_loneliness(person uuid, companionship int, left_out int, isolated int)
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
  join public.org_members m on m.org_id = f.org_id and m.user_id = auth.uid() and public.staff_mfa_ok()
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

create or replace function public.staff_delete_loneliness(check_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.loneliness_checks
  where id = check_id and user_id = auth.uid() and public.staff_mfa_ok() and taken_at > now() - interval '18 hours';
$$;
