-- Hilo: her medical visits (family app v2, Salud → Citas, and the split-flap on Hoy).
-- The family writes them; the whole family (and her phone) reads them. Health data: family only.

create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  -- the senior who goes
  person_id    uuid not null,
  -- as the family writes it, e.g. "Cardióloga"
  title        text not null check (char_length(title) between 1 and 60),
  -- where, e.g. "Hospital de Alcoy, planta 2"
  place        text check (char_length(place) <= 120),
  starts_at    timestamptz not null,
  -- who in the family takes her (optional)
  companion_id uuid references public.people (id) on delete set null,
  added_by     uuid references public.people (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index appointments_person_starts_idx on public.appointments (person_id, starts_at);
create index appointments_family_id_idx on public.appointments (family_id);

alter table public.appointments enable row level security;

create policy "family reads appointments" on public.appointments
  for select to authenticated using (public.is_family_member(family_id));
create policy "members add appointments" on public.appointments
  for insert to authenticated with check (public.family_role(family_id) = 'member');
create policy "members update appointments" on public.appointments
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');
create policy "members delete appointments" on public.appointments
  for delete to authenticated using (public.family_role(family_id) = 'member');
