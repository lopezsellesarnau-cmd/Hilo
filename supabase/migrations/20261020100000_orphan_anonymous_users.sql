-- Hilo: anonymous accounts that never became a senior. Pairing signs the phone in anonymously before
-- claiming the code, so a wrong code (or a pairing left halfway) leaves an auth user with no person.
-- After 7 days they are deleted by the privacy-cleanup Edge Function (every hour).
-- A phone still holding such a session is sent back to Welcome on open (startRoute asks the server).

create function public.delete_orphan_anonymous_users(older_than interval default '7 days')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted int;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - older_than
    and not exists (select 1 from public.people p where p.user_id = u.id);
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Only the cleanup function (service role) may run it
revoke all on function public.delete_orphan_anonymous_users(interval) from public, anon, authenticated;
grant execute on function public.delete_orphan_anonymous_users(interval) to service_role;
