-- Hilo: "Escuchar mi historia". Each approved chapter is read aloud once with her talk voice and kept here,
-- so listening again costs nothing. Private: no policies, only the talk Edge Function (service role)
-- writes the files and hands out short-lived links, after checking she can see the chapter.

insert into storage.buckets (id, name, public)
values ('chapter-audio', 'chapter-audio', false)
on conflict (id) do nothing;
