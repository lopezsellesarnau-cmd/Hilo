-- Hilo: messages from the senior to her family, said in the talk ("dile a Pedro que prepare la cena").
-- Hilo reads the message back to her and sends it only when she says yes. Never inferred from the talk.
-- 'alert': she mentions a fall, pain or feeling unwell. Hilo still tells her to call 112, and the family gets
-- an alert with her words. Not an emergency service: a push can be missed.
-- Written only by the talk Edge Function (service role), which also sends the push.

create table public.family_messages (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null,
  senior_id     uuid not null,
  -- one family member, or null for the whole family
  recipient_id  uuid,
  kind          text not null default 'message' check (kind in ('message', 'alert')),
  body          text not null check (char_length(body) between 1 and 300),
  session_id    uuid references public.talk_sessions (id) on delete set null,
  created_at    timestamptz not null default now(),
  -- first time the recipient (or anyone, when it went to the whole family) opened it
  read_at       timestamptz,
  foreign key (senior_id, family_id) references public.people (id, family_id) on delete cascade,
  foreign key (recipient_id, family_id) references public.people (id, family_id) on delete cascade
);

create index family_messages_senior_created_idx on public.family_messages (senior_id, created_at desc);
create index family_messages_family_id_idx on public.family_messages (family_id);
create index family_messages_recipient_id_idx on public.family_messages (recipient_id);

alter table public.family_messages enable row level security;

-- The family (and her own phone) reads its messages. No insert, update or delete from the app.
create policy "members read family messages" on public.family_messages
  for select to authenticated using (public.is_family_member(family_id));

-- The signed-in family member opened Talks: mark what was sent to them, or to everyone, as read
create function public.read_family_messages(senior uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.people;
begin
  select * into me from public.people
  where user_id = auth.uid() and role = 'member'
    and family_id = (select family_id from public.people where id = senior and role = 'senior');
  if me.id is null then
    raise exception 'Not allowed';
  end if;
  update public.family_messages
  set read_at = now()
  where senior_id = senior and read_at is null and (recipient_id = me.id or recipient_id is null);
end;
$$;

revoke all on function public.read_family_messages(uuid) from public, anon;
grant execute on function public.read_family_messages(uuid) to authenticated;
