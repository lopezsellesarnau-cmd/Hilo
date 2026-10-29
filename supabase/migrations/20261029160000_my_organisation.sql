-- Hilo B2B, legal: her consent screen names the organisation that signed her up ("Cruz Roja ve…"), since
-- with an organisation it is the organisation that decides about her data (GDPR controller), not her family.
-- She can read her family's org_id but not the organisations table (only staff can), so this gives her
-- just the name. Null for a family without an organisation.

create function public.my_organisation_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from public.people p
  join public.families f on f.id = p.family_id
  join public.organizations o on o.id = f.org_id
  where p.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.my_organisation_name() from public, anon;
grant execute on function public.my_organisation_name() to authenticated;
