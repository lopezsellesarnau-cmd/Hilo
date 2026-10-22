-- Hilo: security fixes from the audit of 22 Oct 2026.
-- 1. The senior's 6-digit pairing code could be guessed: no limit on wrong codes.
-- 2. The senior's phone (an anonymous account) could write to people and families: make itself a family
--    member, add people or delete the whole family. Writes there are now for family members only.
-- 3. A family member could add any account to the family without an invite (and skip the Familia plan).
-- 4. Prepares hiding the transcripts from the family: a counter of her answers on each talk, so the family
--    app doesn't need to read the turns. Reading the turns is closed in a later migration, once build 11
--    (which uses the counter) has replaced build 10.

-- ── 1. Pairing: at most 5 wrong codes an hour per phone, and codes live 15 minutes ──────────────────

-- Wrong codes per user, like family_invite_attempts. RLS on and no policies: only the function below.
create table public.pairing_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);

create index pairing_attempts_user_id_idx on public.pairing_attempts (user_id, at);

alter table public.pairing_attempts enable row level security;

alter table public.pairing_codes alter column expires_at set default now() + interval '15 minutes';

-- Returns the senior's person id, or null for a wrong or expired code. No error for a wrong code,
-- so the failed attempt is kept (an error would roll it back).
create or replace function public.claim_pairing_code(pairing_code text)
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
  if (select count(*) from public.pairing_attempts
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many attempts';
  end if;

  delete from public.pairing_codes
  where code = pairing_code and expires_at > now()
  returning * into pc;
  if pc.code is null then
    insert into public.pairing_attempts (user_id) values (auth.uid());
    return null;
  end if;

  update public.people set user_id = auth.uid()
  where id = pc.person_id and user_id is null;
  if not found then
    raise exception 'Already paired';
  end if;
  delete from public.pairing_attempts where user_id = auth.uid();
  return pc.person_id;
end;
$$;

-- ── 2 and 3. Only family members write people and families; nobody changes role, account or family ──

drop policy "members update their family" on public.families;
drop policy "members delete their family" on public.families;
create policy "members update their family" on public.families
  for update to authenticated
  using (public.family_role(id) = 'member')
  with check (public.family_role(id) = 'member');
create policy "members delete their family" on public.families
  for delete to authenticated using (public.family_role(id) = 'member');

drop policy "members add people" on public.people;
drop policy "members update people" on public.people;
drop policy "members remove people" on public.people;
-- The app only adds the senior, without an account: her phone joins with the pairing code,
-- and other family members with an invite (both through security definer functions)
create policy "members add the senior" on public.people
  for insert to authenticated
  with check (public.family_role(family_id) = 'member' and role = 'senior' and user_id is null);
create policy "members update people" on public.people
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');
-- No delete policy: people leave through delete_my_account() and unlink_senior_phone()

-- Only the columns the app edits. family_id, user_id and role change only inside the functions above.
revoke update on public.people from authenticated;
grant update (display_name, timezone, locale, talk_time, voice_speed, memory, city, latitude, longitude,
  country_code, region_code) on public.people to authenticated;

-- ── 4. Her answers per talk, so the family never needs the transcript ─────────────────────────────

alter table public.talk_sessions add column answers int not null default 0;

update public.talk_sessions s
set answers = (select count(*) from public.turns t where t.session_id = s.id and t.speaker = 'senior');

create function public.count_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.talk_sessions set answers = answers + 1 where id = new.session_id;
  return new;
end;
$$;

revoke all on function public.count_answer() from public, anon, authenticated;

create trigger turns_count_answer
  after insert on public.turns
  for each row when (new.speaker = 'senior')
  execute function public.count_answer();
