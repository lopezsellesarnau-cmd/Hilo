-- Hilo: Hilo speaks at normal speed by default. Slowed down (0.90) the neural voices sound robotic;
-- the calm comes from short sentences. The senior can still ask for slower (ajustar_voz).

alter table public.people alter column voice_speed set default 1.00;
