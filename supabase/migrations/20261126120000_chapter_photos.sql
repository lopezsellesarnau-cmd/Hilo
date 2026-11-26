-- Hilo: photos on a story of her book (family app v2, "Add a photo" in the review).
-- Private bucket. Files live at '<family_id>/<chapter_id>/<random>.jpg': only that family reads them,
-- and only its members (not the senior) add or remove them. The chapter keeps the list of paths.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chapter-photos', 'chapter-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

alter table public.chapters add column photos text[] not null default '{}'
  check (cardinality(photos) <= 8);

-- The family whose folder it is: the first part of the path
create policy "family reads chapter photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'chapter-photos' and public.is_family_member(((storage.foldername(name))[1])::uuid));

create policy "members add chapter photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chapter-photos' and public.family_role(((storage.foldername(name))[1])::uuid) = 'member');

create policy "members remove chapter photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chapter-photos' and public.family_role(((storage.foldername(name))[1])::uuid) = 'member');
