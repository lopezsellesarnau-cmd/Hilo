-- Hilo: medications (the schedule) and medication_events (each daily confirmation).
-- Family members manage the schedule; the senior can only read it and confirm doses.
-- Reminders themselves are local notifications on the phone: this is the record.

-- ── Helper ───────────────────────────────────────────────────────────────

-- The signed-in user's role in this family: 'senior', 'member' or null.
create function public.family_role(fid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.people
  where family_id = fid and user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.family_role(uuid) from public, anon;
grant execute on function public.family_role(uuid) to authenticated;

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.medications (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  -- the senior who takes it
  person_id    uuid not null,
  -- as the family writes it, e.g. "Pastilla de la tensión"
  name         text not null check (char_length(name) between 1 and 80),
  -- local times in the person's timezone, e.g. {09:00, 21:00}
  times        time[] not null check (cardinality(times) between 1 and 8),
  -- ISO weekdays 1 (Monday) to 7 (Sunday); all days by default
  weekdays     smallint[] not null default '{1,2,3,4,5,6,7}'
               check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{1,2,3,4,5,6,7}'),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, family_id),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index medications_family_id_idx on public.medications (family_id);

create table public.medication_events (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null,
  medication_id  uuid not null,
  -- the dose this event is about: local date + local time from medications.times
  scheduled_date date not null,
  scheduled_time time not null,
  status         text not null check (status in ('taken', 'missed', 'snoozed')),
  -- when it was confirmed; shown as "Tomada a las 09:15"
  confirmed_at   timestamptz,
  -- who confirmed it (the senior, or a family member on their behalf)
  confirmed_by   uuid references public.people (id) on delete set null,
  -- where it came from: the pills screen, the daily talk, or the family app
  source         text not null default 'app' check (source in ('app', 'talk', 'family')),
  created_at     timestamptz not null default now(),
  unique (medication_id, scheduled_date, scheduled_time),
  foreign key (medication_id, family_id) references public.medications (id, family_id) on delete cascade
);

create index medication_events_family_date_idx on public.medication_events (family_id, scheduled_date);

-- ── Row Level Security ──────────────────────────────────────────────────

alter table public.medications       enable row level security;
alter table public.medication_events enable row level security;

-- medications: everyone in the family reads; only family members (not the senior) change the schedule
create policy "family reads medications" on public.medications
  for select to authenticated using (public.is_family_member(family_id));
create policy "members add medications" on public.medications
  for insert to authenticated with check (public.family_role(family_id) = 'member');
create policy "members update medications" on public.medications
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');
create policy "members delete medications" on public.medications
  for delete to authenticated using (public.family_role(family_id) = 'member');

-- medication_events: senior and members read and confirm; only members delete
create policy "family reads events" on public.medication_events
  for select to authenticated using (public.is_family_member(family_id));
create policy "family confirms doses" on public.medication_events
  for insert to authenticated with check (public.is_family_member(family_id));
-- e.g. "Deshacer" after a wrong tap, or snoozed → taken
create policy "family updates doses" on public.medication_events
  for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));
create policy "members delete events" on public.medication_events
  for delete to authenticated using (public.family_role(family_id) = 'member');
