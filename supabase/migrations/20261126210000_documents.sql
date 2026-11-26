-- Hilo: her documents, encrypted end to end (phase B of vault Senior-App/11-documentos-cifrados-plan).
-- Needs 20261126190000_family_vault.sql first.
-- The server only ever sees locked bytes: the file, its title, type and name are all encrypted on the phone.
--  · Each document has its own key, locked with the family key (key_wrap).
--  · meta (title, type, file name) is locked with the document's key.
-- Only family members (never the senior's phone, never anon) see or write any of it.

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  -- the locked file in the family-docs bucket: <family_id>/<random>
  path        text not null unique,
  -- size of the original file, in bytes (the only thing the server can tell about it)
  size        integer not null check (size > 0),
  -- the document's key, locked with the family key: base64(nonce ‖ secretbox)
  key_wrap    text not null,
  -- {title, mime, name}, locked with the document's key: base64(nonce ‖ secretbox)
  meta        text not null,
  created_by  uuid references public.people (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index documents_family_idx on public.documents (family_id, created_at desc);

alter table public.documents enable row level security;

create policy "members read documents" on public.documents
  for select to authenticated using (public.family_role(family_id) = 'member');
create policy "members add documents" on public.documents
  for insert to authenticated
  with check (
    public.family_role(family_id) = 'member'
    and split_part(path, '/', 1) = family_id::text
  );
create policy "members rename documents" on public.documents
  for update to authenticated
  using (public.family_role(family_id) = 'member')
  with check (public.family_role(family_id) = 'member');
create policy "members delete documents" on public.documents
  for delete to authenticated using (public.family_role(family_id) = 'member');

-- Only the meta can change (a new title); the file, its key and its family stay as they are
revoke update on public.documents from authenticated;
grant update (meta) on public.documents to authenticated;

-- The files: a private bucket of locked bytes, one folder per family, 25 MB each
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-docs', 'family-docs', false, 26214400, array['application/octet-stream']);

create policy "members read family docs" on storage.objects
  for select to authenticated
  using (bucket_id = 'family-docs' and public.family_role(((storage.foldername(name))[1])::uuid) = 'member');
create policy "members add family docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'family-docs' and public.family_role(((storage.foldername(name))[1])::uuid) = 'member');
create policy "members delete family docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'family-docs' and public.family_role(((storage.foldername(name))[1])::uuid) = 'member');
