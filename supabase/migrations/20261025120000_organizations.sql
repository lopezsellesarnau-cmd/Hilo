-- Hilo B2B, step 1: organisations (care homes, councils, home-care companies) and their staff.
-- A senior in an organisation still lives in a family (the app works as before); the family points to the
-- organisation. Staff only READ here: what they may change comes in later steps, one page at a time.
-- Staff never see talks, turns or stories: no policy below touches those tables.

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

-- Staff accounts. Rows are added by Hilo (service role) for now; no invite flow yet.
create table public.org_members (
  org_id       uuid not null references public.organizations (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'carer' check (role in ('admin', 'carer')),
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at   timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index org_members_user_id_idx on public.org_members (user_id);

-- null = a normal B2C family
alter table public.families add column org_id uuid references public.organizations (id) on delete set null;
create index families_org_id_idx on public.families (org_id);

-- Families may rename themselves, but not move into (or out of) an organisation.
revoke update on public.families from authenticated;
grant update (name) on public.families to authenticated;

-- ── Helpers ──────────────────────────────────────────────────────────────

-- True when the signed-in user is staff of this organisation.
create function public.is_org_member(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members
    where org_id = oid and user_id = auth.uid()
  );
$$;

-- True when the signed-in user is staff of the organisation this family belongs to.
create function public.is_org_staff_for_family(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.families f
    join public.org_members m on m.org_id = f.org_id
    where f.id = fid and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_staff_for_family(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_staff_for_family(uuid) to authenticated;

-- ── Row Level Security ──────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.org_members   enable row level security;

create policy "staff read their organisation" on public.organizations
  for select to authenticated using (public.is_org_member(id));

create policy "staff read their colleagues" on public.org_members
  for select to authenticated using (public.is_org_member(org_id));

create policy "staff read their families" on public.families
  for select to authenticated using (public.is_org_staff_for_family(id));

-- No policy on people for staff: that row holds Hilo's memory of her talks. Staff get the people of their
-- organisation through this function, with the safe columns only.
create function public.staff_people()
returns table (id uuid, family_id uuid, role text, display_name text, timezone text, locale text,
               paired boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.family_id, p.role, p.display_name, p.timezone, p.locale,
         p.user_id is not null, p.created_at
  from public.people p
  where public.is_org_staff_for_family(p.family_id)
  order by p.display_name;
$$;

revoke all on function public.staff_people() from public, anon;
grant execute on function public.staff_people() to authenticated;
