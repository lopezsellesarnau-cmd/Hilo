-- Hilo: her life in books (plan: vault Senior-App/13-libro-en-libros-plan).
-- A story is still one per talk (public.chapters, reviewed by the family as before). Stories now go one after
-- another into a chapter of a book:
--   · a talk's story goes into the open chapter (the last one of her last book);
--   · a chapter is full at CHAPTER_CHARS characters; then the next story starts a new chapter;
--   · a book has at most 3 chapters; after the third is full, the next story starts a new book;
--   · a story is never split: if it goes over the limit, it stays whole where it started.
-- Titles: "Book 1" / "Chapter 1" until Hilo names them (the talk function, when one fills up).
-- The parts of her life (chapters.part) stay as a tag on each story.

create table public.books (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null,
  person_id   uuid not null,
  number      smallint not null check (number >= 1),
  title       text check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  unique (person_id, number),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create table public.book_chapters (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books (id) on delete cascade,
  family_id   uuid not null,
  person_id   uuid not null,
  number      smallint not null check (number between 1 and 3),
  title       text check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  unique (book_id, number),
  foreign key (person_id, family_id) references public.people (id, family_id) on delete cascade
);

create index books_family_id_idx on public.books (family_id);
create index book_chapters_family_id_idx on public.book_chapters (family_id);

alter table public.chapters add column book_chapter_id uuid references public.book_chapters (id) on delete set null;
create index chapters_book_chapter_idx on public.chapters (book_chapter_id, created_at);

-- ── Row Level Security ──────────────────────────────────────────────────
-- Only place_story (called by the talk Edge Function) makes books and chapters.

alter table public.books enable row level security;
alter table public.book_chapters enable row level security;

create policy "family reads books" on public.books
  for select to authenticated using (public.is_family_member(family_id));
create policy "members rename books" on public.books
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');

create policy "family reads book chapters" on public.book_chapters
  for select to authenticated using (public.is_family_member(family_id));
create policy "members rename book chapters" on public.book_chapters
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');

-- ── Placing a story ─────────────────────────────────────────────────────

-- How many characters a chapter holds before the next story starts a new one
create or replace function public.chapter_chars() returns int language sql immutable as $$ select 1000 $$;

-- Characters already in a chapter (its stories' paragraphs)
create or replace function public.book_chapter_length(p_chapter uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(char_length(array_to_string(paragraphs, ''))), 0)::int
  from public.chapters where book_chapter_id = p_chapter;
$$;

-- Puts one story in its chapter (open one, next one or a new book). Returns the chapter it went into,
-- and whether that chapter is now full (then Hilo can name it).
create or replace function public.place_story(p_story uuid, out chapter_id uuid, out is_full boolean)
language plpgsql security definer set search_path = public as $$
declare
  s record;
  v_book uuid;
  v_book_no int;
  v_chapter uuid;
  v_chapter_no int;
begin
  select id, family_id, person_id, book_chapter_id into s from public.chapters where id = p_story for update;
  if not found then return; end if;
  if s.book_chapter_id is not null then
    chapter_id := s.book_chapter_id;
    is_full := public.book_chapter_length(chapter_id) >= public.chapter_chars();
    return;
  end if;

  -- One story at a time per person, so two talks ending together don't both open a new book
  perform pg_advisory_xact_lock(hashtext('place_story:' || s.person_id::text));

  select id, number into v_book, v_book_no from public.books where person_id = s.person_id order by number desc limit 1;
  if v_book is not null then
    select id, number into v_chapter, v_chapter_no from public.book_chapters where book_id = v_book order by number desc limit 1;
  end if;

  if v_chapter is null or public.book_chapter_length(v_chapter) >= public.chapter_chars() then
    if v_book is null or coalesce(v_chapter_no, 0) >= 3 then
      insert into public.books (family_id, person_id, number)
      values (s.family_id, s.person_id, coalesce(v_book_no, 0) + 1)
      returning id into v_book;
      v_chapter_no := 0;
    end if;
    insert into public.book_chapters (book_id, family_id, person_id, number)
    values (v_book, s.family_id, s.person_id, coalesce(v_chapter_no, 0) + 1)
    returning id into v_chapter;
  end if;

  update public.chapters set book_chapter_id = v_chapter where id = s.id;
  chapter_id := v_chapter;
  is_full := public.book_chapter_length(v_chapter) >= public.chapter_chars();
end;
$$;

revoke all on function public.place_story(uuid) from public, anon, authenticated;
revoke all on function public.book_chapter_length(uuid) from public, anon, authenticated;
grant execute on function public.place_story(uuid) to service_role;

-- ── Stories written before this: into books, oldest first ──────────────
do $$
declare r record;
begin
  for r in select id from public.chapters where book_chapter_id is null order by person_id, created_at loop
    perform public.place_story(r.id);
  end loop;
end $$;
