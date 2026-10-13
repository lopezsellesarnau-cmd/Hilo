-- Hilo: the waitlist from the landing page (hilo-web), with the answers to the short questionnaire.
-- The web only calls join_waitlist(); nobody can read the table with the anon key.
-- Signing up twice with the same email updates the answers, so the web never learns if an email was already there.

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (char_length(email) between 5 and 254 and email like '%_@_%._%'),
  -- who the family is looking for
  who         text not null check (who in ('mother', 'father', 'grandparent', 'self', 'other')),
  -- what worries them most (one or more)
  worries     text[] not null check (
                cardinality(worries) between 1 and 4
                and worries <@ array['loneliness', 'pills', 'wellbeing', 'stories']
              ),
  phone       text not null check (phone in ('daily', 'struggles', 'none')),
  price       text not null check (price in ('none', 'up_to_5', '5_10', '10_20', 'over_20')),
  -- optional: "what should Hilo do so you would use it?"
  comment     text check (char_length(comment) <= 1000),
  locale      text not null default 'es' check (locale in ('es', 'en', 'nl')),
  -- utm_source or similar, to know which post brought them
  source      text check (char_length(source) <= 100),
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index waitlist_email_idx on public.waitlist (lower(email));

-- RLS on and no policies: only join_waitlist() and the service role (dashboard) touch it
alter table public.waitlist enable row level security;

create function public.join_waitlist(
  p_email text,
  p_who text,
  p_worries text[],
  p_phone text,
  p_price text,
  p_comment text default null,
  p_locale text default 'es',
  p_source text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (email, who, worries, phone, price, comment, locale, source)
  values (lower(trim(p_email)), p_who, p_worries, p_phone, p_price, nullif(trim(p_comment), ''), p_locale, p_source)
  on conflict ((lower(email))) do update set
    who        = excluded.who,
    worries    = excluded.worries,
    phone      = excluded.phone,
    price      = excluded.price,
    comment    = coalesce(excluded.comment, public.waitlist.comment),
    locale     = excluded.locale,
    consent_at = now(),
    updated_at = now();
$$;

revoke all on function public.join_waitlist(text, text, text[], text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text[], text, text, text, text, text) to anon, authenticated;
