-- Hilo B2B, step 7b: New person as the canvas frame. Two more things staff choose when they add her:
-- her carer (one person of the team) and Hilo's voice speed (heard first with voice-sample).
-- The carer is on the family (one senior per family); null for B2C families and when nobody is assigned.

alter table public.families
  add column carer_id uuid references auth.users (id) on delete set null;

-- Replaces step 7's version (two more arguments)
drop function public.staff_create_person(uuid, text, text, time, text, text, double precision,
  double precision, text, text, jsonb);

create function public.staff_create_person(
  org uuid,
  name text,
  locale text,
  talk_time time,
  timezone text,
  voice_speed numeric default 1.00,
  carer uuid default null,
  city text default null,
  latitude double precision default null,
  longitude double precision default null,
  country_code text default null,
  region_code text default null,
  pills jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  pid uuid;
  pill jsonb;
begin
  if not public.is_org_member(org) then
    raise exception 'Not your organisation';
  end if;
  if carer is not null and not exists (select 1 from public.org_members m where m.org_id = org and m.user_id = carer) then
    raise exception 'Carer not in the organisation';
  end if;
  if jsonb_typeof(pills) is distinct from 'array' or jsonb_array_length(pills) > 20 then
    raise exception 'Bad pills';
  end if;

  insert into public.families (name, org_id, carer_id) values (btrim(name), org, carer) returning id into fid;

  -- voice_speed is checked by the table (0.70-1.20)
  insert into public.people (family_id, role, display_name, locale, talk_time, timezone, voice_speed,
                             city, latitude, longitude, country_code, region_code)
  values (fid, 'senior', btrim(name), locale, talk_time, timezone, voice_speed,
          city, latitude, longitude, country_code, region_code)
  returning id into pid;

  insert into public.subscriptions (family_id, plan, status, product_id)
  values (fid, 'family', 'active', 'organisation');

  -- Bad names or times fail the table's checks, and the whole person is rolled back
  for pill in select * from jsonb_array_elements(pills) loop
    insert into public.medications (family_id, person_id, name, times)
    values (fid, pid, btrim(pill ->> 'name'),
            array(select jsonb_array_elements_text(pill -> 'times')::time order by 1));
  end loop;

  return pid;
end;
$$;

revoke all on function public.staff_create_person(uuid, text, text, time, text, numeric, uuid, text,
  double precision, double precision, text, text, jsonb) from public, anon;
grant execute on function public.staff_create_person(uuid, text, text, time, text, numeric, uuid, text,
  double precision, double precision, text, text, jsonb) to authenticated;
