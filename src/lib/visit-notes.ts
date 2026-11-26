import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';

/**
 * "Ready for Friday" (frame 3 · Health): what the family takes to her next visit. Only facts from the
 * last 7 full days, never an interpretation (Hilo gives no medical advice):
 * pills taken and missed, and the days she talked with Hilo. The weight comes from the Health screen.
 */

export type Missed = { name: string; date: string; time: string };
export type VisitNotes = { expected: number; taken: number; missed: Missed[]; talkedDays: number; days: number };

const DAY = 86_400_000;

export async function loadVisitNotes(seniorId: string, timeZone: string): Promise<VisitNotes> {
  // The last 7 full days, in her time zone (today is still going on)
  const days = Array.from({ length: 7 }, (_, i) => localNow(timeZone, new Date(Date.now() - (i + 1) * DAY))).reverse();
  const first = days[0].date;
  const last = days[days.length - 1].date;

  const [{ data: meds }, { data: talks }] = await Promise.all([
    supabase.from('medications').select('id, name, times, weekdays, created_at').eq('person_id', seniorId).eq('active', true),
    supabase
      .from('talk_sessions')
      .select('started_at')
      .eq('person_id', seniorId)
      .gte('started_at', new Date(Date.now() - 9 * DAY).toISOString()),
  ]);
  const ids = (meds ?? []).map((m) => m.id);
  const { data: events } = ids.length
    ? await supabase
        .from('medication_events')
        .select('medication_id, scheduled_date, scheduled_time')
        .in('medication_id', ids)
        .eq('status', 'taken')
        .gte('scheduled_date', first)
        .lte('scheduled_date', last)
    : { data: [] };
  const taken = new Set((events ?? []).map((e) => `${e.medication_id}|${e.scheduled_date}|${String(e.scheduled_time).slice(0, 5)}`));

  let expected = 0;
  const missed: Missed[] = [];
  for (const day of days) {
    for (const m of meds ?? []) {
      // Not counted before the pill was added, nor on days it isn't taken
      if (localNow(timeZone, new Date(m.created_at)).date > day.date || !(m.weekdays as number[]).includes(day.weekday)) continue;
      for (const raw of m.times as string[]) {
        const time = raw.slice(0, 5);
        expected++;
        if (!taken.has(`${m.id}|${day.date}|${time}`)) missed.push({ name: m.name, date: day.date, time });
      }
    }
  }

  const talked = new Set((talks ?? []).map((s) => localNow(timeZone, new Date(s.started_at)).date).filter((d) => d >= first && d <= last));
  return { expected, taken: expected - missed.length, missed, talkedDays: talked.size, days: days.length };
}
