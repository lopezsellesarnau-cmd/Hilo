-- Hilo: locked document files that must go (phase D of vault Senior-App/11-documentos-cifrados-plan).
-- A file stays only while its row in public.documents exists. A deleted document, a deleted family
-- (account deletion: families → documents, by cascade) or an upload whose row never arrived leaves files in
-- 'family-docs', and the privacy-cleanup Edge Function deletes them every hour.
-- Files younger than an hour are left alone: the app writes the row a moment after the upload.

create function public.orphan_family_docs(max_files int default 500)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'family-docs'
    and o.created_at < now() - interval '1 hour'
    and not exists (select 1 from public.documents d where d.path = o.name)
  limit max_files;
$$;

-- Only the cleanup function (service role) may ask
revoke all on function public.orphan_family_docs(int) from public, anon, authenticated;
grant execute on function public.orphan_family_docs(int) to service_role;
