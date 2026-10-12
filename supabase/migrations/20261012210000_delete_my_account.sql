-- Hilo: "Borrar mi cuenta" (required by Apple, and GDPR right to erasure).
-- Deletes the signed-in user's account. If they are the last family member left,
-- the whole family goes too: the senior, pills, consents and their phone's anonymous account.
-- Runs as the function owner, so the app never needs the service_role key.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  fid uuid;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  for fid in select family_id from public.people where user_id = uid and role = 'member' loop
    if not exists (
      select 1 from public.people
      where family_id = fid and role = 'member' and user_id is not null and user_id <> uid
    ) then
      delete from auth.users
      where id in (select user_id from public.people where family_id = fid and role = 'senior' and user_id is not null);
      delete from public.families where id = fid;
    end if;
  end loop;

  delete from public.people where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
