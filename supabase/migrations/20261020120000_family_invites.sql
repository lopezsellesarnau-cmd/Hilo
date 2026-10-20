-- Hilo: more family members. A member creates an invite code (8 digits, shown as a QR too) and sends it
-- to a brother, a daughter or a grandson. They sign in with their email and join the same family:
-- same senior, same book, same alerts, and the family's subscription covers them.
-- Unlike the senior's pairing code it lasts 7 days and works for everyone it is sent to.
-- Tables with RLS on and no policies: the app only goes through the two functions below.

create table public.family_invites (
  code       text primary key check (code ~ '^[0-9]{8}$'),
  -- one live code per family: a new one replaces it
  family_id  uuid not null unique references public.families on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

alter table public.family_invites enable row level security;

-- Wrong codes per user, so nobody can try codes until one works
create table public.family_invite_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);

create index family_invite_attempts_user_id_idx on public.family_invite_attempts (user_id, at);

alter table public.family_invite_attempts enable row level security;

-- A family member asks for the family's invite code. Replaces the old one.
create function public.create_family_invite()
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

-- Someone signed in with their email joins the family of this code. Returns the family id,
-- or null for a wrong or expired code (no error, so the failed attempt is kept).
create function public.join_family(invite_code text, member_name text)
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

  insert into public.people (family_id, user_id, role, display_name) values (fid, auth.uid(), 'member', member_name);
  delete from public.family_invite_attempts where user_id = auth.uid();
  return fid;
end;
$$;

revoke all on function public.create_family_invite() from public, anon;
revoke all on function public.join_family(text, text) from public, anon;
grant execute on function public.create_family_invite() to authenticated;
grant execute on function public.join_family(text, text) to authenticated;
