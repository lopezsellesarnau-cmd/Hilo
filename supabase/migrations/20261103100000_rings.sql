-- Hilo: the family presses "Llamar ahora" and Hilo rings on the senior's iPhone like a call (CallKit).
-- The Edge Function ring sends the VoIP push and records the call here; her phone says when she answers.

-- ── Her phone's VoIP token ─────────────────────────────────────────────────

-- PushKit token, not the alert token of push_tokens: only this kind of push makes the phone ring when locked.
-- Its own table so the family, who can read people, never sees it.
create table public.voip_tokens (
  person_id   uuid primary key references public.people on delete cascade,
  token       text not null check (char_length(token) between 16 and 200),
  updated_at  timestamptz not null default now()
);

-- Only the function below and the service role touch it
alter table public.voip_tokens enable row level security;

-- Saves this phone's token for the signed-in senior (one phone each: pairing a new one replaces it)
create function public.save_voip_token(device_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.voip_tokens (person_id, token)
  select id, device_token from public.people where user_id = auth.uid() and role = 'senior'
  on conflict (person_id) do update set token = excluded.token, updated_at = now();
$$;

revoke all on function public.save_voip_token(text) from public, anon;
grant execute on function public.save_voip_token(text) to authenticated;

-- ── The calls ──────────────────────────────────────────────────────────────

create table public.rings (
  -- Also the call's id on her phone (CallKit), so her answer finds this row
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null,
  family_id    uuid not null,
  -- Who pressed the button
  asked_by     uuid references auth.users on delete set null,
  status       text not null default 'ringing' check (status in ('ringing', 'answered', 'missed')),
  -- 2 after the one retry when she doesn't answer
  attempts     smallint not null default 1 check (attempts between 1 and 2),
  created_at   timestamptz not null default now(),
  -- The last time it rang: the retry moves it
  rang_at      timestamptz not null default now(),
  answered_at  timestamptz,
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index rings_person_id_idx on public.rings (person_id, created_at desc);

-- The family sees its calls; only the Edge Function (service role) creates them
alter table public.rings enable row level security;

create policy "family reads rings" on public.rings
  for select to authenticated using (public.is_family_member(family_id));

-- She answered on her phone. Only while it's still ringing, and only her own calls
create function public.answer_ring(ring_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rings set status = 'answered', answered_at = now()
  where id = ring_id and status = 'ringing' and public.is_senior(person_id);
$$;

revoke all on function public.answer_ring(uuid) from public, anon;
grant execute on function public.answer_ring(uuid) to authenticated;
