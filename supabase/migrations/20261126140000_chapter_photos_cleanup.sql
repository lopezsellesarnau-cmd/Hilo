-- Hilo: story photos that must go. A file stays only while its chapter exists and still lists it:
-- a discarded story, a photo taken off, or a deleted account (family → people → chapters, by cascade)
-- leaves files in 'chapter-photos', and the privacy-cleanup Edge Function deletes them every hour.
-- Files younger than an hour are left alone: the app saves the list a moment after the upload.

create function public.orphan_chapter_photos(max_files int default 500)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'chapter-photos'
    and o.created_at < now() - interval '1 hour'
    and not exists (
      select 1 from public.chapters c
      where c.id::text = (storage.foldername(o.name))[2]
        and o.name = any (c.photos)
    )
  limit max_files;
$$;

-- Only the cleanup function (service role) may ask
revoke all on function public.orphan_chapter_photos(int) from public, anon, authenticated;
grant execute on function public.orphan_chapter_photos(int) to service_role;
