-- Hilo: "De qué hablar con ella". After each talk, one sentence for the family about something she told Hilo
-- ("Hoy le ha contado que bailaba en las fiestas: pregúntale con quién iba"), so they have something to call about.
-- Written by the talk Edge Function together with her notes; null when nothing suitable came up.
-- Never health, sadness, money, complaints about the family or anything she asked to keep private.
-- The family already reads talk_sessions through RLS; the app shows the line for 3 days.

alter table public.talk_sessions
  add column family_note text check (char_length(family_note) <= 240);
