-- Hilo: the shape of her Hilo (family app v2, "Choose your Hilo" on her phone's first screen).
-- She picks it once on her phone; the family sees the same Bot everywhere and can change it in Ajustes.

alter table public.people add column bot_shape text not null default 'hexagon'
  check (bot_shape in ('circle', 'squircle', 'pill', 'arch', 'drop', 'triangle', 'cloud', 'clover', 'hexagon'));

-- Family members change it like the other columns the app edits
grant update (bot_shape) on public.people to authenticated;

-- She can't update people (only members can): this one function lets her set her own shape, and nothing else
create function public.set_my_bot_shape(shape text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.people
  set bot_shape = shape
  where user_id = auth.uid() and role = 'senior';
  if not found then
    raise exception 'Not allowed';
  end if;
end;
$$;

revoke all on function public.set_my_bot_shape(text) from public, anon;
grant execute on function public.set_my_bot_shape(text) to authenticated;
