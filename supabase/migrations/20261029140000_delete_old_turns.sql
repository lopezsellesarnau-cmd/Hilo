-- Hilo: her talks word for word are deleted 90 days after the talk, for families and organisations alike.
-- Nothing needs them by then: the chapter and Hilo's memory are written when each talk ends, from that talk
-- only, and the apps never show old talks. What stays: the session (date, length, answers, the sentence for
-- the family), her book, her memory (she can read and correct it) and her private notes.
-- Run every hour by the privacy-cleanup Edge Function.

create function public.delete_old_turns(older_than interval default '90 days')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted int;
begin
  delete from public.turns t
  using public.talk_sessions s
  where s.id = t.session_id
    and s.started_at < now() - older_than;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Only the cleanup function (service role) may run it
revoke all on function public.delete_old_turns(interval) from public, anon, authenticated;
grant execute on function public.delete_old_turns(interval) to service_role;
