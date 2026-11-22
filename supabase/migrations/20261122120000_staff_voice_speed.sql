-- Hilo B2B: Hilo's voice speed on the person page, instead of the 12-week grid.
--
-- The grid (staff_person_activity, 20261121120000) didn't stay: staff_open_person goes back to her week,
-- and now also says how fast Hilo talks to her, so the page can show the voice card with its speed.
-- Staff could only set the speed when they added her (staff_create_person); people.voice_speed is
-- otherwise editable only by her family (RLS). staff_set_voice_speed lets her organisation's staff change
-- it, with the same check as the rest of the staff functions (her organisation, second step done).

drop function if exists public.staff_person_activity(uuid);

-- The person page: her week and Hilo's voice speed, logged once as before
create or replace function public.staff_open_person(person uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := public.staff_person_week(person)
    || jsonb_build_object('voice_speed', (select p.voice_speed from public.people p where p.id = person));
  perform public.log_staff_access(
    (select f.org_id from public.people p join public.families f on f.id = p.family_id where p.id = person),
    person,
    'person'
  );
  return result;
end;
$$;

-- Change it. The table's check keeps it between 0.70 and 1.20.
create function public.staff_set_voice_speed(person uuid, speed numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
begin
  select p.family_id into fid from public.people p where p.id = person and p.role = 'senior';
  if fid is null or not public.is_org_staff_for_family(fid) then
    raise exception 'Not your organisation';
  end if;
  update public.people set voice_speed = speed where id = person;
end;
$$;

revoke all on function public.staff_set_voice_speed(uuid, numeric) from public, anon;
grant execute on function public.staff_set_voice_speed(uuid, numeric) to authenticated;
