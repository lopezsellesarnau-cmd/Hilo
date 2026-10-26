-- Hilo B2B, step 7: staff add a person from the organisation ("New person"), then pair her phone at the visit.
-- She still lives in a family of her own (no members yet: relatives can join later with an invite), and the
-- family points to the organisation. The organisation pays: the family gets an active subscription with no end,
-- marked product_id = 'organisation' (billed outside the app during the pilot; RevenueCat never writes it).
-- Staff can't write families, people or medications directly, so both steps are security definer functions.

-- Creates her family, her row, the subscription and her pills, in one go. Returns her person id.
-- pills: [{"name": "Enalapril", "times": ["09:00", "21:00"]}, …]
create function public.staff_create_person(
  org uuid,
  name text,
  locale text,
  talk_time time,
  timezone text,
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
  if jsonb_typeof(pills) is distinct from 'array' or jsonb_array_length(pills) > 20 then
    raise exception 'Bad pills';
  end if;

  insert into public.families (name, org_id) values (btrim(name), org) returning id into fid;

  insert into public.people (family_id, role, display_name, locale, talk_time, timezone,
                             city, latitude, longitude, country_code, region_code)
  values (fid, 'senior', btrim(name), locale, talk_time, timezone,
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

-- The code for her phone, made by staff at the visit. Same table and 15-minute life as the family's code
-- (create_pairing_code), and the same rate-limited claim on the phone.
create function public.staff_pairing_code(senior uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
  new_code text;
begin
  select family_id into fid from public.people
  where id = senior and role = 'senior' and user_id is null;
  if fid is null or not public.is_org_staff_for_family(fid) then
    raise exception 'Not allowed';
  end if;

  delete from public.pairing_codes where person_id = senior or expires_at < now();

  loop
    -- 24 random bits from pgcrypto, cut down to 6 digits
    new_code := lpad(((('x' || encode(extensions.gen_random_bytes(3), 'hex'))::bit(24)::int) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.pairing_codes where code = new_code);
  end loop;

  insert into public.pairing_codes (code, family_id, person_id, created_by)
  values (new_code, fid, senior, auth.uid());
  return new_code;
end;
$$;

revoke all on function public.staff_create_person(uuid, text, text, time, text, text, double precision,
  double precision, text, text, jsonb) from public, anon;
revoke all on function public.staff_pairing_code(uuid) from public, anon;
grant execute on function public.staff_create_person(uuid, text, text, time, text, text, double precision,
  double precision, text, text, jsonb) to authenticated;
grant execute on function public.staff_pairing_code(uuid) to authenticated;
