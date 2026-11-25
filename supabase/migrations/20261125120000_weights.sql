-- Hilo: her weight over time (family app v2, Salud). One row per weighing.
-- Written by a family member (the tape in Salud) or, later, by the talk ("hoy peso 61").
-- Health data (GDPR special category): only her family reads it; same consent as the rest.

create table public.weights (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  -- the senior who was weighed
  person_id    uuid not null,
  kg           numeric(4, 1) not null check (kg between 20 and 250),
  -- when she was weighed (defaults to now; the family can log an earlier day)
  measured_at  timestamptz not null default now(),
  -- where it came from: the family app, the talk, or a scale (Apple Health), later
  source       text not null default 'family' check (source in ('family', 'talk', 'scale')),
  -- who logged it
  added_by     uuid references public.people (id) on delete set null,
  created_at   timestamptz not null default now(),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index weights_person_measured_idx on public.weights (person_id, measured_at desc);
create index weights_family_id_idx on public.weights (family_id);

alter table public.weights enable row level security;

-- The whole family (and her own phone) reads; family members (not the senior) add, fix and remove
create policy "family reads weights" on public.weights
  for select to authenticated using (public.is_family_member(family_id));
create policy "members add weights" on public.weights
  for insert to authenticated with check (public.family_role(family_id) = 'member');
create policy "members update weights" on public.weights
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');
create policy "members delete weights" on public.weights
  for delete to authenticated using (public.family_role(family_id) = 'member');
