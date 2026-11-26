-- Hilo: the family calls her, voice to voice, inside Hilo (plan: vault Senior-App/12-llamadas-plan, piece 1).
-- The family member presses "Call": the voice-call Edge Function opens a LiveKit room (EU), rings her iPhone with a
-- VoIP push (CallKit: "Laura · Hilo") and gives both phones a token for that room. Nothing is recorded:
-- this table only says who called, when, and how it ended (for the family's list of calls).

create table public.voice_calls (
  -- Also the call's id on her phone (CallKit) and the LiveKit room's name
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  senior_id    uuid not null,
  -- the family member calling
  caller_id    uuid not null references public.people (id) on delete cascade,
  status       text not null default 'ringing' check (status in ('ringing', 'active', 'ended', 'missed', 'declined')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  foreign key (senior_id, family_id) references public.people (id, family_id) on delete cascade
);

create index voice_calls_senior_idx on public.voice_calls (senior_id, created_at desc);

-- The family (and she) can see the calls; only the Edge Function (service role) creates and changes them
alter table public.voice_calls enable row level security;
create policy "family reads voice calls" on public.voice_calls
  for select to authenticated using (public.is_family_member(family_id));

-- The caller's phone hears at once when she answers, declines or hangs up
alter publication supabase_realtime add table public.voice_calls;
