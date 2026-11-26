-- Hilo: her book in chapters (family app v2, frame "8 · A chapter").
-- Each story (a row in public.chapters) belongs to one part of her life, from a fixed list, and may carry the year
-- it happened. Hilo picks both when it writes the story; the family can move it to another part.
-- Stories written before this have no part: they show under "More stories".

alter table public.chapters
  add column part text check (part in ('childhood', 'school', 'youth', 'love', 'work', 'children', 'home', 'travels', 'traditions', 'today', 'more')),
  add column year smallint check (year between 1900 and 2100);
