-- Hilo: "this stays between us". When she clearly asks Hilo to keep a story to itself, Hilo writes one short line
-- about it here (the entre_nosotros tool in the talk Edge Function). That story is left out of her book chapter,
-- the note for her family and the memory notes the family can read and edit (people.memory).
-- Hilo still remembers it: the lines are given to Hilo at the start of her next talks, only for talking with her.
-- The family is never told she kept something private.
--
-- No policies on purpose, like usage: only the service role (the talk Edge Function) reads and writes it.
-- Not the family, not staff, not even her own phone through the API. Not in talk_sessions: the family reads that.

create table public.private_notes (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  person_id   uuid not null,
  -- the talk where she said it; kept if the family deletes that talk, so Hilo doesn't forget
  session_id  uuid references public.talk_sessions (id) on delete set null,
  -- what to leave out, in a few words ("her worry about money"), never the story itself
  what        text not null check (char_length(what) between 1 and 200),
  created_at  timestamptz not null default now(),
  -- she deletes her account → the notes go with her
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index private_notes_person_created_idx on public.private_notes (person_id, created_at);

alter table public.private_notes enable row level security;
revoke all on public.private_notes from anon, authenticated;
