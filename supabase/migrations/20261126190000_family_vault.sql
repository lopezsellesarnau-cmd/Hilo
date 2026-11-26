-- Hilo: the keys for her documents, encrypted end to end (plan: vault Senior-App/11-documentos-cifrados-plan).
-- The server never holds a key it can open:
--  · family_vault: one row per family. The family key, locked with the recovery code (Argon2id on the phone).
--  · family_devices: each family member's phone, with its public key (the private one never leaves the phone).
--  · family_key_wraps: the family key sealed for each approved phone (only that phone's private key opens it).
-- Only family members (never the senior's phone, never anon) see or write any of it.

create table public.family_vault (
  family_id      uuid primary key references public.families (id) on delete cascade,
  -- the family key, sealed with a key derived from the recovery code: base64(nonce ‖ secretbox)
  recovery_wrap  text not null,
  -- the Argon2id salt for the recovery code, base64
  recovery_salt  text not null,
  created_by     uuid references public.people (id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.family_devices (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families (id) on delete cascade,
  member_id    uuid not null references public.people (id) on delete cascade,
  -- X25519 public key, base64
  public_key   text not null check (char_length(public_key) between 40 and 60),
  -- what the others see when it asks for access, e.g. "iPhone de Laura"
  name         text not null check (char_length(name) between 1 and 60),
  created_at   timestamptz not null default now(),
  unique (family_id, public_key)
);

create index family_devices_family_idx on public.family_devices (family_id);

create table public.family_key_wraps (
  device_id    uuid primary key references public.family_devices (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  -- crypto_box_seal(family key, device public key), base64
  wrapped_key  text not null,
  -- the phone that approved it (null when it was the one that created the vault or used the code)
  approved_by  uuid references public.family_devices (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index family_key_wraps_family_idx on public.family_key_wraps (family_id);

alter table public.family_vault enable row level security;
alter table public.family_devices enable row level security;
alter table public.family_key_wraps enable row level security;

-- The vault: members read it (to recover with the code) and create it once
create policy "members read the vault" on public.family_vault
  for select to authenticated using (public.family_role(family_id) = 'member');
create policy "members create the vault" on public.family_vault
  for insert to authenticated with check (public.family_role(family_id) = 'member');

-- Phones: members see the family's phones; each member adds only their own; any member can remove one
create policy "members read devices" on public.family_devices
  for select to authenticated using (public.family_role(family_id) = 'member');
create policy "members add their device" on public.family_devices
  for insert to authenticated
  with check (
    public.family_role(family_id) = 'member'
    and member_id = (select p.id from public.people p where p.user_id = auth.uid() and p.family_id = family_devices.family_id)
  );
create policy "members remove devices" on public.family_devices
  for delete to authenticated using (public.family_role(family_id) = 'member');

-- Sealed keys: members read them (useless without the phone's private key) and add one to approve a phone
create policy "members read key wraps" on public.family_key_wraps
  for select to authenticated using (public.family_role(family_id) = 'member');
create policy "members add key wraps" on public.family_key_wraps
  for insert to authenticated
  with check (
    public.family_role(family_id) = 'member'
    and exists (select 1 from public.family_devices d where d.id = device_id and d.family_id = family_key_wraps.family_id)
  );
create policy "members remove key wraps" on public.family_key_wraps
  for delete to authenticated using (public.family_role(family_id) = 'member');
