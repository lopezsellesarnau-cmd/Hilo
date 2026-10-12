-- Hilo: pair the senior's phone with a 6-digit code.
-- A family member creates a code for their senior; the senior's phone signs in
-- anonymously and claims it, which links that anonymous user to the senior row.
-- The table has RLS on and no policies: the app only touches it through the two functions below.

create table public.pairing_codes (
  code       text primary key check (code ~ '^[0-9]{6}$'),
  family_id  uuid not null,
  person_id  uuid not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 minutes',
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

alter table public.pairing_codes enable row level security;

-- Anonymous users (the senior's phone before pairing) are "authenticated" too.
-- They must not be able to start a family of their own.
create or replace function public.create_family(family_name text, member_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Not signed in';
  end if;
  insert into public.families (name) values (family_name) returning id into new_id;
  insert into public.people (family_id, user_id, role, display_name)
  values (new_id, auth.uid(), 'member', member_name);
  return new_id;
end;
$$;

-- A family member asks for a code for their senior. Replaces any older code.
create function public.create_pairing_code(senior_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  new_code text;
begin
  select family_id into fid from public.people
  where id = senior_id and role = 'senior' and user_id is null;
  if fid is null or public.family_role(fid) is distinct from 'member' then
    raise exception 'Not allowed';
  end if;

  delete from public.pairing_codes where person_id = senior_id or expires_at < now();

  loop
    -- 24 random bits from pgcrypto, cut down to 6 digits
    new_code := lpad(((('x' || encode(extensions.gen_random_bytes(3), 'hex'))::bit(24)::int) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.pairing_codes where code = new_code);
  end loop;

  insert into public.pairing_codes (code, family_id, person_id, created_by)
  values (new_code, fid, senior_id, auth.uid());
  return new_code;
end;
$$;

-- The senior's phone claims a code. Returns the senior's person id. Each code works once.
create function public.claim_pairing_code(pairing_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  pc public.pairing_codes;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.people where user_id = auth.uid()) then
    raise exception 'Already paired';
  end if;

  delete from public.pairing_codes
  where code = pairing_code and expires_at > now()
  returning * into pc;
  if pc.code is null then
    raise exception 'Invalid or expired code';
  end if;

  update public.people set user_id = auth.uid()
  where id = pc.person_id and user_id is null;
  if not found then
    raise exception 'Already paired';
  end if;
  return pc.person_id;
end;
$$;

revoke all on function public.create_pairing_code(uuid) from public, anon;
revoke all on function public.claim_pairing_code(text) from public, anon;
grant execute on function public.create_pairing_code(uuid) to authenticated;
grant execute on function public.claim_pairing_code(text) to authenticated;
