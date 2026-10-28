-- Hilo: security phase 2. Her talks word for word are hers: only she reads the turns.
-- The family app only shows how many answers there were (talk_sessions.answers, since build 11), so it
-- doesn't need them. Staff never read them. Edge Functions with the service role are not affected.
-- The talk Edge Function reads her turns as her (her own session), so it keeps working.

drop policy "family reads turns" on public.turns;

create policy "senior reads own turns" on public.turns
  for select to authenticated
  using (exists (
    select 1 from public.talk_sessions s
    where s.id = session_id and s.family_id = turns.family_id and public.is_senior(s.person_id)
  ));
