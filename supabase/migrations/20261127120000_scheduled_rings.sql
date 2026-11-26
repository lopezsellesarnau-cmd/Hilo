-- Hilo calls her at her chat time (plan: vault Senior-App/12-llamadas-plan, piece 2).
-- Every minute the ring-scheduled Edge Function looks for seniors whose talk_time is now (in their time zone),
-- with a phone that can ring and no talk yet today, and makes Hilo ring like a call. No answer: once more
-- 10 minutes later; still no answer: the family is told. The family can switch it off in the talk settings.

-- On by default: it's what "her chat time" means from now on
alter table public.people add column hilo_calls boolean not null default true;
grant update (hilo_calls) on public.people to authenticated;

-- A ring Hilo made on its own at her chat time (the family's button leaves it false)
alter table public.rings add column scheduled boolean not null default false;

create index rings_ringing_idx on public.rings (rang_at) where status = 'ringing';
