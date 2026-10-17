-- Hilo: tell the family when the senior hasn't talked for 2 days.
-- The family's phones register their push token here; the Edge Function quiet-alert
-- (run every hour by Supabase Cron) checks each senior and sends the alert through Apple (APNs).

-- ── Push tokens of the family's phones ─────────────────────────────────────

create table public.push_tokens (
  -- APNs device token: one row per phone, whoever is signed in on it now
  token       text primary key check (char_length(token) between 16 and 200),
  user_id     uuid not null references auth.users on delete cascade,
  family_id   uuid not null references public.families on delete cascade,
  -- the phone's language, for the text of the alert
  locale      text not null default 'es' check (locale in ('es', 'en', 'nl')),
  updated_at  timestamptz not null default now()
);

create index push_tokens_family_id_idx on public.push_tokens (family_id);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- Only the functions below and the service role touch it
alter table public.push_tokens enable row level security;

-- Saves this phone's token for the signed-in family member.
-- A phone that changes hands (sign out, another account) moves to the new user.
create function public.save_push_token(device_token text, phone_locale text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid;
begin
  select family_id into fid from public.people where user_id = auth.uid() and role = 'member' limit 1;
  if fid is null then
    raise exception 'Not a family member';
  end if;
  insert into public.push_tokens (token, user_id, family_id, locale)
  values (device_token, auth.uid(), fid, coalesce(nullif(phone_locale, ''), 'es'))
  on conflict (token) do update set
    user_id    = excluded.user_id,
    family_id  = excluded.family_id,
    locale     = excluded.locale,
    updated_at = now();
end;
$$;

revoke all on function public.save_push_token(text, text) from public, anon;
grant execute on function public.save_push_token(text, text) to authenticated;

-- On sign out: this phone stops getting the family's alerts
create function public.forget_push_token(device_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = device_token and user_id = auth.uid();
$$;

revoke all on function public.forget_push_token(text) from public, anon;
grant execute on function public.forget_push_token(text) to authenticated;

-- ── When the family was last told ──────────────────────────────────────────

-- So the alert is not repeated every hour: at most one every 2 days while she stays quiet
alter table public.people add column quiet_alert_at timestamptz;
