-- Hilo: memory between talks. A few short notes about her (people, places, plans, what was said last time),
-- rewritten by the talk Edge Function after each talk and given to Hilo at the start of the next one.
-- Cheaper and safer than sending old transcripts: only what helps the next talk, never the whole history.
-- The family can read and correct it (same policies as the rest of people); the talk function rewrites it.

alter table public.people
  add column memory text check (char_length(memory) <= 2000),
  add column memory_updated_at timestamptz;
