-- Hilo B2B, legal: who on the staff looked at what (GDPR art. 5.2 and 32; an organisation will ask for it).
--
-- One row each time a staff member opens a person's page or the reports. The database writes it, inside
-- the functions the staff web calls, so nobody can skip it by calling the API directly: the old functions
-- (staff_person_week, staff_report) can no longer be called by staff, only through the two below.
-- Only the organisation's admins read the log. Nobody can change or delete it; her rows go only when her
-- account is deleted (cascade). The same page opened again within a minute isn't logged twice
-- (the web reloads it, and Reports asks for two periods at once).
--
-- Not logged: Today and People (a list of everyone, the organisation's normal work), and her loneliness
-- checks and the team's notes, which the person page reads straight from their tables (RLS) right after.

create table public.staff_access_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  -- kept as null if the staff member's account is deleted, so the log still says it happened
  user_id    uuid references auth.users (id) on delete set null,
  -- null for the reports (the whole organisation)
  person_id  uuid references public.people (id) on delete cascade,
  what       text not null check (what in ('person', 'report')),
  at         timestamptz not null default now()
);

create index staff_access_log_org_idx on public.staff_access_log (org_id, at desc);
create index staff_access_log_person_idx on public.staff_access_log (person_id, at desc);

alter table public.staff_access_log enable row level security;

-- Read: the organisation's admins. No write policies: only the functions below write.
create policy "admins read their access log" on public.staff_access_log
  for select to authenticated
  using (exists (
    select 1 from public.org_members m
    where m.org_id = staff_access_log.org_id and m.user_id = auth.uid() and m.role = 'admin'
  ));

create function public.log_staff_access(org uuid, person uuid, kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.staff_access_log (org_id, user_id, person_id, what)
  select org, auth.uid(), person, kind
  where not exists (
    select 1 from public.staff_access_log l
    where l.user_id = auth.uid() and l.what = kind and l.person_id is not distinct from person
      and l.at > now() - interval '1 minute'
  );
$$;

revoke all on function public.log_staff_access(uuid, uuid, text) from public, anon, authenticated;

-- ── The person page ─────────────────────────────────────────────────────

-- staff_person_week(person) checks she belongs to the caller's organisation; if not, it raises and nothing is logged.
create function public.staff_open_person(person uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.staff_person_week(person);
  perform public.log_staff_access(
    (select f.org_id from public.people p join public.families f on f.id = p.family_id where p.id = person),
    person,
    'person'
  );
  return result;
end;
$$;

revoke all on function public.staff_open_person(uuid) from public, anon;
grant execute on function public.staff_open_person(uuid) to authenticated;
revoke execute on function public.staff_person_week(uuid) from public, anon, authenticated;

-- ── Reports ─────────────────────────────────────────────────────────────

-- staff_report checks the caller is staff of org and the period is sane.
create function public.staff_open_report(org uuid, from_day date, to_day date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.staff_report(org, from_day, to_day);
  perform public.log_staff_access(org, null, 'report');
  return result;
end;
$$;

revoke all on function public.staff_open_report(uuid, date, date) from public, anon;
grant execute on function public.staff_open_report(uuid, date, date) to authenticated;
revoke execute on function public.staff_report(uuid, date, date) from public, anon, authenticated;
