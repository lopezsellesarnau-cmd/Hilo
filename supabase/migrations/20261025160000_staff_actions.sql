-- Hilo B2B, step 5: staff mark a person as done on Today ("I called her"), with an optional note for the team.
-- Everyone in the organisation sees who did what, so two carers don't call the same person.
-- Writes go through the two functions below: they check the person belongs to the caller's organisation
-- (staff can't read "people" directly, so a policy couldn't check it).

create table public.staff_actions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  person_id  uuid not null references public.people (id) on delete cascade,
  -- the staff member; kept as null if their account is deleted
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null default 'done' check (kind in ('done')),
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index staff_actions_org_created_idx on public.staff_actions (org_id, created_at desc);
create index staff_actions_person_idx on public.staff_actions (person_id);

alter table public.staff_actions enable row level security;

-- Read: the whole organisation. No insert/update/delete policies: only the functions write.
create policy "staff read their actions" on public.staff_actions
  for select to authenticated using (public.is_org_member(org_id));

-- "Done": the signed-in staff member dealt with this person today. Returns the new row's id.
create function public.staff_mark_done(person uuid, note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  oid uuid;
  new_id uuid;
begin
  select f.org_id into oid
  from public.people p
  join public.families f on f.id = p.family_id
  join public.org_members m on m.org_id = f.org_id and m.user_id = auth.uid()
  where p.id = person and p.role = 'senior';
  if oid is null then
    raise exception 'Not your organisation';
  end if;
  insert into public.staff_actions (org_id, person_id, user_id, note)
  values (oid, person, auth.uid(), nullif(btrim(note), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- "Undo": only your own action, and only the same day (a mistaken tap, not rewriting history).
create function public.staff_undo(action uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.staff_actions
  where id = action and user_id = auth.uid() and created_at > now() - interval '18 hours';
$$;

revoke all on function public.staff_mark_done(uuid, text) from public, anon;
revoke all on function public.staff_undo(uuid) from public, anon;
grant execute on function public.staff_mark_done(uuid, text) to authenticated;
grant execute on function public.staff_undo(uuid) to authenticated;
