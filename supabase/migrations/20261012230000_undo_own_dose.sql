-- "Deshacer" on the senior's pills screen: anyone in the family can delete a dose
-- they confirmed themselves in the last 10 minutes (a wrong tap). Older records stay.
create policy "people undo their own recent dose" on public.medication_events
  for delete to authenticated
  using (
    public.is_family_member(family_id)
    and created_at > now() - interval '10 minutes'
    and confirmed_by in (select id from public.people where user_id = auth.uid())
  );
