-- Hilo: recordings of "Escuchar mi historia" that must go. A file stays only while its chapter exists
-- and is approved: a discarded story, a story taken back to draft or a deleted account (family → people →
-- chapters, by cascade) leaves files here, and the privacy-cleanup Edge Function deletes them every hour.
-- The files themselves can only be removed through the Storage API, not with SQL: this only lists them.

create function public.orphan_chapter_audio(max_files int default 500)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chapter-audio'
    and not exists (
      select 1 from public.chapters c
      where c.id::text = (storage.foldername(o.name))[2]
        and c.status = 'approved'
    )
  limit max_files;
$$;

-- Only the cleanup function (service role) may ask
revoke all on function public.orphan_chapter_audio(int) from public, anon, authenticated;
grant execute on function public.orphan_chapter_audio(int) to service_role;
