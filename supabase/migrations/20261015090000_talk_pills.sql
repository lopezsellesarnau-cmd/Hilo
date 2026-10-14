-- Hilo: the talk asks about today's pills once. This is when Hilo asked in this talk (null: not yet),
-- so it isn't asked twice. The answer itself goes to medication_events (source 'talk').

alter table public.talk_sessions add column pills_asked_at timestamptz;
