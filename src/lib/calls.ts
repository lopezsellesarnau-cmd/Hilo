import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';

/** A call to her: who, when, and whether it came from the button or from what she told Hilo */
export type Call = { name: string; mine: boolean; at: string; source: 'button' | 'talk' };

/** Her latest calls, newest first, with the family member's name */
export async function loadCalls(seniorId: string, limit = 5): Promise<Call[]> {
  const [{ data: calls }, { data: members }, { data: session }] = await Promise.all([
    supabase
      .from('family_calls')
      .select('member_id, called_at, source')
      .eq('senior_id', seniorId)
      .order('called_at', { ascending: false })
      .limit(limit),
    supabase.from('people').select('id, display_name, user_id').eq('role', 'member'),
    supabase.auth.getSession(),
  ]);
  return (calls ?? []).map((c) => {
    const m = members?.find((x) => x.id === c.member_id);
    return { name: m?.display_name ?? '', mine: m?.user_id === session.session?.user.id, at: c.called_at, source: c.source };
  });
}

/** "La he llamado": counts for "Llama a la abuela", so nobody is nudged the day someone called */
export async function iCalled(seniorId: string) {
  const { error } = await supabase.rpc('i_called', { senior: seniorId });
  if (error) throw error;
}

/** 'hoy', 'ayer', or the weekday (and the date after a week), in her time zone */
export function dayLabel(iso: string, timeZone: string) {
  const day = localNow(timeZone, new Date(iso)).date;
  const today = localNow(timeZone).date;
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  if (diff === 0) return t.talks.today;
  if (diff === 1) return t.talks.yesterday;
  return new Date(iso).toLocaleDateString(dateLocale, {
    timeZone,
    weekday: 'long',
    ...(diff > 6 ? { day: 'numeric', month: 'short' } : {}),
  });
}
