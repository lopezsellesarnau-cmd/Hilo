import { dateLocale } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** A medical visit of hers (family app v2). Times are shown in her time zone. */
export type Visit = { id: string; title: string; place: string | null; startsAt: string };

/** Her visits from two hours ago on, soonest first */
export async function loadVisits(seniorId: string): Promise<Visit[]> {
  const { data } = await supabase
    .from('appointments')
    .select('id, title, place, starts_at')
    .eq('person_id', seniorId)
    .gte('starts_at', new Date(Date.now() - 2 * 3_600_000).toISOString())
    .order('starts_at')
    .limit(50);
  return (data ?? []).map((v) => ({ id: v.id, title: v.title, place: v.place, startsAt: v.starts_at }));
}

export async function addVisit(v: { familyId: string; seniorId: string; title: string; place: string; startsAt: string; addedBy: string | null }) {
  const { error } = await supabase.from('appointments').insert({
    family_id: v.familyId,
    person_id: v.seniorId,
    title: v.title.trim(),
    place: v.place.trim() || null,
    starts_at: v.startsAt,
    added_by: v.addedBy,
  });
  return !error;
}

export async function deleteVisit(id: string) {
  const { error } = await supabase.from('appointments').delete().eq('id', id);
  return !error;
}

/** How far a time zone is from UTC at that moment, in ms */
function offset(at: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(at))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at;
}

/** '2026-11-27' + '10:30' in her time zone → an ISO instant */
export function zonedIso(day: string, time: string, timeZone: string) {
  const [y, m, d] = day.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  return new Date(guess - offset(guess - offset(guess, timeZone), timeZone)).toISOString();
}

/** For the split-flap on Hoy: 'FRI 10:30' (in her language and time zone) */
export function flapText(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(dateLocale, { weekday: 'short', timeZone }).replace('.', '').slice(0, 3);
  const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
  return `${day} ${time}`.toUpperCase();
}

/** 'Fri 27 Nov · 10:30' */
export function visitWhen(iso: string, timeZone: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).replace(/\./g, '');
  const time = d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${time}`;
}

/** 'Fri' for the block in Salud */
export function visitDay(iso: string, timeZone: string) {
  const s = new Date(iso).toLocaleDateString(dateLocale, { weekday: 'short', timeZone }).replace('.', '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
