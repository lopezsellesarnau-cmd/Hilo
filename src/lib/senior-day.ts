import { supabase } from '@/lib/supabase';
import { buildDoses, localNow, type Dose } from '@/lib/time';

export type SeniorMe = {
  id: string;
  family_id: string;
  display_name: string;
  timezone: string;
};

/**
 * The senior's own row on this phone and today's doses (schedule + confirmations).
 * Shared by the home and the pills screen so both count the same thing.
 */
export async function loadSeniorDay(): Promise<{ me: SeniorMe; doses: Dose[] } | { me: null; error: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const { data: me } = await supabase
    .from('people')
    .select('id, family_id, display_name, timezone')
    .eq('user_id', session?.user.id ?? '')
    .eq('role', 'senior')
    .maybeSingle();
  if (!me)
    return {
      me: null,
      error: 'Este móvil aún no está conectado con tu familia.',
    };
  const today = localNow(me.timezone);
  const { data: meds } = await supabase
    .from('medications')
    .select('id, name, times, weekdays')
    .eq('person_id', me.id)
    .eq('active', true);
  const ids = (meds ?? []).map((m) => m.id);
  const { data: events } = ids.length
    ? await supabase
        .from('medication_events')
        .select('id, medication_id, scheduled_time, status, confirmed_at')
        .in('medication_id', ids)
        .eq('scheduled_date', today.date)
    : { data: [] };
  if (!meds || !events)
    return {
      me: null,
      error: 'No hay conexión. Prueba otra vez en un momento.',
    };
  return { me, doses: buildDoses(meds, events, me.timezone, today.weekday) };
}
