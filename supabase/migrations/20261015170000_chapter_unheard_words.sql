-- Hilo: "nothing invented", checked in code. When a chapter is written, the words of the story
-- that don't appear in what she said are kept here, so the family checks them before approving.

alter table public.chapters add column unheard_words text[] not null default '{}';
