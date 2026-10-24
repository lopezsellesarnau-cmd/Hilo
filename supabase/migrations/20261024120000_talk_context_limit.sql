-- Hilo: today's context (weather, holidays and, since 20 Oct, the "ask about her family" hint) can pass
-- 600 characters, and then every new talk failed on the check. It's written only by the talk Edge Function,
-- so the limit is just a safety cap: 2000, and the function trims to fit.

alter table public.talk_sessions drop constraint talk_sessions_context_check;
alter table public.talk_sessions
  add constraint talk_sessions_context_check check (char_length(context) <= 2000);
