-- Hilo: families, people and consents.
-- Every table belongs to a family and has Row Level Security from day one:
-- a signed-in user only ever sees the families they belong to.

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.people (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  -- null for a senior who has not paired their phone yet
  user_id      uuid references auth.users (id) on delete set null,
  role         text not null check (role in ('senior', 'member')),
  display_name text not null check (char_length(display_name) between 1 and 60),
  -- IANA name, e.g. Europe/Madrid. Pill times are stored in local time, so this matters for daylight saving.
  timezone     text not null default 'Europe/Madrid',
  locale       text not null default 'es' check (locale in ('es', 'en', 'nl')),
  created_at   timestamptz not null default now(),
  unique (family_id, user_id),
  -- lets other tables check that a person belongs to the same family
  unique (id, family_id)
);

create index people_family_id_idx on public.people (family_id);
create index people_user_id_idx on public.people (user_id);

-- GDPR: who agreed to what, and when. Rows are never edited away, only revoked.
create table public.consents (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  person_id  uuid not null,
  kind       text not null check (kind in ('terms', 'voice_recording', 'health_data', 'life_story')),
  -- version of the text the person accepted, e.g. '2026-10-v1'
  version    text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  -- the person must be from the same family as the consent
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index consents_family_id_idx on public.consents (family_id);
create index consents_person_id_idx on public.consents (person_id);

-- ── Helper ───────────────────────────────────────────────────────────────

-- True when the signed-in user belongs to this family.
-- security definer so policies on "people" don't call themselves in a loop.
create function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people
    where family_id = fid and user_id = auth.uid()
  );
$$;

-- Creates a family and adds the caller as its first member, in one step.
create function public.create_family(family_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.families (name) values (family_name) returning id into new_id;
  insert into public.people (family_id, user_id, role, display_name)
  values (new_id, auth.uid(), 'member', member_name);
  return new_id;
end;
$$;

revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.create_family(text, text) from public, anon;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.create_family(text, text) to authenticated;

-- ── Row Level Security ──────────────────────────────────────────────────

alter table public.families enable row level security;
alter table public.people   enable row level security;
alter table public.consents enable row level security;

-- families: created only through create_family(); members read, rename and delete
create policy "members read their family" on public.families
  for select to authenticated using (public.is_family_member(id));
create policy "members update their family" on public.families
  for update to authenticated using (public.is_family_member(id)) with check (public.is_family_member(id));
-- deleting a family deletes everything in it (GDPR "delete all my data")
create policy "members delete their family" on public.families
  for delete to authenticated using (public.is_family_member(id));

-- people: members manage the people of their own family
create policy "members read people" on public.people
  for select to authenticated using (public.is_family_member(family_id));
create policy "members add people" on public.people
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "members update people" on public.people
  for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "members remove people" on public.people
  for delete to authenticated using (public.is_family_member(family_id));

-- consents: read, give and revoke inside your family; no deletes (audit trail)
create policy "members read consents" on public.consents
  for select to authenticated using (public.is_family_member(family_id));
create policy "members give consent" on public.consents
  for insert to authenticated with check (public.is_family_member(family_id));
create policy "members revoke consent" on public.consents
  for update to authenticated using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
