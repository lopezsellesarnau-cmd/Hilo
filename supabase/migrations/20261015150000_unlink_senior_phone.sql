-- Hilo: the family connects a new phone for the senior (new phone, or the app was reinstalled).
-- The old phone stops working with Hilo: its anonymous user no longer has a person.
-- Only family members (not the senior) can do it. After this, create_pairing_code() works again.

create function public.unlink_senior_phone(senior_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
begin
  select family_id into fid from public.people where id = senior_id and role = 'senior';
  if fid is null or public.family_role(fid) is distinct from 'member' then
    raise exception 'Not allowed';
  end if;
  update public.people set user_id = null where id = senior_id;
end;
$$;

revoke all on function public.unlink_senior_phone(uuid) from public, anon;
grant execute on function public.unlink_senior_phone(uuid) to authenticated;
