-- Hilo: the book of her life. One chapter (a story) per talk that had a real memory,
-- written in her own words by the talk Edge Function when the talk ends.
-- The family reviews every draft; the senior only sees what the family approved. Nothing is printed without approval.

create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null,
  -- the senior whose story it is
  person_id    uuid not null,
  -- the talk it was written from; kept if the family deletes the talk
  session_id   uuid unique references public.talk_sessions (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 120),
  -- one sentence of hers, word for word, shown large in the chapter
  quote        text check (char_length(quote) <= 400),
  paragraphs   text[] not null check (cardinality(paragraphs) between 1 and 20),
  status       text not null default 'draft' check (status in ('draft', 'approved')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index chapters_family_id_idx on public.chapters (family_id);
create index chapters_person_created_idx on public.chapters (person_id, created_at);

-- ── Row Level Security ──────────────────────────────────────────────────
-- Only the talk Edge Function (service role) writes chapters, so there is no insert policy.

alter table public.chapters enable row level security;

-- Family members read drafts and approved chapters; the senior only approved ones
create policy "family reads chapters" on public.chapters
  for select to authenticated
  using (
    public.is_family_member(family_id)
    and (status = 'approved' or public.family_role(family_id) = 'member')
  );

-- Members approve or correct a chapter
create policy "members update chapters" on public.chapters
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');

-- Members discard a chapter
create policy "members delete chapters" on public.chapters
  for delete to authenticated using (public.family_role(family_id) = 'member');
