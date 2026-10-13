-- Hilo: the daily talk. One talk_sessions row per talk, one turns row per message,
-- and a usage row per senior and day to know the cost of each user from the first test.
-- Turns are the literal transcript: the family reads them to review the book chapters.

-- ── Tables ───────────────────────────────────────────────────────────────

create table public.talk_sessions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  -- the senior who talks
  person_id   uuid not null,
  locale      text not null default 'es' check (locale in ('es', 'en', 'nl')),
  started_at  timestamptz not null default now(),
  -- null while the talk is open, or if the senior left in the middle
  ended_at    timestamptz,
  unique (id, family_id),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index talk_sessions_person_started_idx on public.talk_sessions (person_id, started_at desc);
create index talk_sessions_family_id_idx on public.talk_sessions (family_id);

create table public.turns (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  session_id  uuid not null,
  -- 1, 2, 3… in the order they were said
  seq         int not null check (seq > 0),
  speaker     text not null check (speaker in ('hilo', 'senior')),
  text        text not null check (char_length(text) between 1 and 8000),
  created_at  timestamptz not null default now(),
  unique (session_id, seq),
  foreign key (session_id, family_id) references public.talk_sessions (id, family_id) on delete cascade
);

create index turns_family_id_idx on public.turns (family_id);

-- Counters per senior and day, written only by the Edge Functions (service role)
create table public.usage (
  family_id          uuid not null,
  person_id          uuid not null,
  day                date not null,
  llm_input_tokens   int not null default 0,
  llm_output_tokens  int not null default 0,
  tts_characters     int not null default 0,
  primary key (person_id, day),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index usage_family_id_idx on public.usage (family_id);

-- Adds to today's counters in one statement, so two calls at once don't lose a count
create function public.add_usage(pid uuid, usage_day date, input_tokens int, output_tokens int, characters int)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage (family_id, person_id, day, llm_input_tokens, llm_output_tokens, tts_characters)
  select family_id, id, usage_day, input_tokens, output_tokens, characters from public.people where id = pid
  on conflict (person_id, day) do update set
    llm_input_tokens  = public.usage.llm_input_tokens  + excluded.llm_input_tokens,
    llm_output_tokens = public.usage.llm_output_tokens + excluded.llm_output_tokens,
    tts_characters    = public.usage.tts_characters    + excluded.tts_characters;
$$;

revoke all on function public.add_usage(uuid, date, int, int, int) from public, anon, authenticated;
grant execute on function public.add_usage(uuid, date, int, int, int) to service_role;

-- ── Row Level Security ──────────────────────────────────────────────────

alter table public.talk_sessions enable row level security;
alter table public.turns         enable row level security;
alter table public.usage         enable row level security;

-- The senior's own row in that family, if the signed-in user is the senior
create function public.is_senior(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.people where id = pid and user_id = auth.uid() and role = 'senior');
$$;

revoke all on function public.is_senior(uuid) from public, anon;
grant execute on function public.is_senior(uuid) to authenticated;

-- talk_sessions: the family reads; only the senior opens and closes their own talks
create policy "family reads talks" on public.talk_sessions
  for select to authenticated using (public.is_family_member(family_id));
create policy "senior starts a talk" on public.talk_sessions
  for insert to authenticated with check (public.is_senior(person_id));
create policy "senior ends a talk" on public.talk_sessions
  for update to authenticated using (public.is_senior(person_id)) with check (public.is_senior(person_id));
-- members can delete a talk (e.g. something the senior didn't want kept)
create policy "members delete talks" on public.talk_sessions
  for delete to authenticated using (public.family_role(family_id) = 'member');

-- turns: the family reads; written into the senior's own talks (by the app or the talk Edge Function as the senior)
create policy "family reads turns" on public.turns
  for select to authenticated using (public.is_family_member(family_id));
create policy "senior adds turns" on public.turns
  for insert to authenticated
  with check (exists (
    select 1 from public.talk_sessions s
    where s.id = session_id and s.family_id = turns.family_id and public.is_senior(s.person_id)
  ));

-- usage: no policies on purpose. Only the service role (Edge Functions) reads and writes it.
