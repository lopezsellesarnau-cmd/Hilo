-- Hilo: how fast Hilo speaks to each senior (1 = normal; Azure prosody rate or ElevenLabs speed).
-- Starts a little slow; changes when the senior asks ("habla más despacio") or the family adjusts it.
-- Only the talk Edge Function (service role) and family members change it.

alter table public.people
  add column voice_speed numeric(3, 2) not null default 0.90 check (voice_speed between 0.70 and 1.20);
