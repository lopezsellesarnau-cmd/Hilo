-- Hilo: the family's subscription, as RevenueCat reports it.
-- The family pays (RevenueCat app user = family_id), and every phone of the family reads it from here:
-- the senior's phone never buys anything, but its talk needs to know the family has paid.
-- Written only by the Edge Function revenuecat-webhook (service role), or by hand for founding families.

create table public.subscriptions (
  family_id   uuid primary key references public.families on delete cascade,
  -- basic: 1 talk a day. family: up to 3.
  plan        text not null check (plan in ('basic', 'family')),
  status      text not null check (status in ('trial', 'active', 'expired')),
  -- null = no end (given by hand, e.g. a founding family or a tester)
  expires_at  timestamptz,
  product_id  text,
  updated_at  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "family reads its subscription" on public.subscriptions
  for select to authenticated using (public.is_family_member(family_id));

-- To give a family access by hand (testers, founding families):
-- insert into public.subscriptions (family_id, plan, status) values ('<family id>', 'family', 'active')
-- on conflict (family_id) do update set plan = excluded.plan, status = excluded.status, expires_at = null;
