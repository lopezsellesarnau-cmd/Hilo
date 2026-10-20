-- Hilo: "Llama a la abuela". Who in the family talked with the senior, and when.
-- Two sources: the "La he llamado" button on Hoy, and what she tells Hilo in the talk ("hablé con Laura"),
-- saved by the talk Edge Function. After 3 days with no call, quiet-alert nudges one family member.
-- Also: inviting more family members is part of the Familia plan (Básico = one family member).

-- ── Familia plan only for invites ──────────────────────────────────────────

-- True while the family has the Familia plan (trial or paid, not expired)
create function public.has_family_plan(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.family_id = fid and s.plan = 'family' and s.status <> 'expired'
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

revoke all on function public.has_family_plan(uuid) from public, anon;
grant execute on function public.has_family_plan(uuid) to authenticated;

create or replace function public.create_family_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  new_code text;
begin
  select family_id into fid from public.people where user_id = auth.uid() and role = 'member' limit 1;
  if fid is null then
    raise exception 'Not allowed';
  end if;
  if not public.has_family_plan(fid) then
    raise exception 'Family plan only';
  end if;

  delete from public.family_invites where family_id = fid or expires_at < now();

  loop
    -- 32 random bits from pgcrypto, cut down to 8 digits
    new_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 2147483647) % 100000000)::text, 8, '0');
    exit when not exists (select 1 from public.family_invites where code = new_code);
  end loop;

  insert into public.family_invites (code, family_id, created_by) values (new_code, fid, auth.uid());
  return new_code;
end;
$$;

-- Same as before, plus: a code from a family that went back to Básico no longer lets anyone in
create or replace function public.join_family(invite_code text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
begin
  -- The senior's anonymous phone cannot join as a family member
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.people where user_id = auth.uid()) then
    raise exception 'Already in a family';
  end if;
  if (select count(*) from public.family_invite_attempts
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many attempts';
  end if;

  select family_id into fid from public.family_invites where code = invite_code and expires_at > now();
  if fid is null then
    insert into public.family_invite_attempts (user_id) values (auth.uid());
    return null;
  end if;
  if not public.has_family_plan(fid) then
    raise exception 'Family plan only';
  end if;

  insert into public.people (family_id, user_id, role, display_name) values (fid, auth.uid(), 'member', member_name);
  delete from public.family_invite_attempts where user_id = auth.uid();
  return fid;
end;
$$;

-- ── Calls ──────────────────────────────────────────────────────────────────

create table public.family_calls (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null,
  senior_id  uuid not null,
  -- the family member who called (or visited)
  member_id  uuid not null,
  -- 'button': they tapped "La he llamado". 'talk': she told Hilo.
  source     text not null check (source in ('button', 'talk')),
  called_at  timestamptz not null default now(),
  foreign key (senior_id, family_id) references public.people (id, family_id) on delete cascade,
  foreign key (member_id, family_id) references public.people (id, family_id) on delete cascade
);

create index family_calls_senior_called_idx on public.family_calls (senior_id, called_at desc);
create index family_calls_family_id_idx on public.family_calls (family_id);

alter table public.family_calls enable row level security;

-- The family sees its calls. Writes only through i_called() and the talk function (service role).
create policy "members read family calls" on public.family_calls
  for select to authenticated using (public.is_family_member(family_id));

-- "La he llamado": the signed-in family member called their senior. Once an hour is enough.
create function public.i_called(senior uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.people;
  fid uuid;
begin
  select family_id into fid from public.people where id = senior and role = 'senior';
  select * into me from public.people where family_id = fid and user_id = auth.uid() and role = 'member';
  if me.id is null then
    raise exception 'Not allowed';
  end if;
  if exists (
    select 1 from public.family_calls
    where member_id = me.id and senior_id = senior and called_at > now() - interval '1 hour'
  ) then
    return;
  end if;
  insert into public.family_calls (family_id, senior_id, member_id, source) values (fid, senior, me.id, 'button');
end;
$$;

revoke all on function public.i_called(uuid) from public, anon;
grant execute on function public.i_called(uuid) to authenticated;

-- When the family was last nudged to call, so it isn't repeated every evening
alter table public.people add column call_alert_at timestamptz;
