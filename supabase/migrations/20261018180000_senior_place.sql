-- Hilo: where she lives, so the talk can mention today's weather and the holidays of her region.
-- The family types the town once; the app looks it up (OpenStreetMap) and saves the result here.
-- Only the town, never the street: enough for the weather, nothing more.

alter table public.people
  add column city text check (char_length(city) between 1 and 80),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  -- ISO codes, e.g. ES and ES-VC: Nager.Date uses them for national and regional holidays
  add column country_code text check (country_code ~ '^[A-Z]{2}$'),
  add column region_code text check (char_length(region_code) <= 10);

-- The weather and holidays line given to Hilo when a talk starts. Saved on the talk so every turn sends
-- the same opening message (prompt cache) and the APIs are called once per talk, not once per turn.
alter table public.talk_sessions
  add column context text check (char_length(context) <= 600);
