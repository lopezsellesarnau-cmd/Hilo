import type { Href } from 'expo-router';

import { supabase } from '@/lib/supabase';

/**
 * Where a signed-in family member should go: the first onboarding step they have not done yet,
 * or the family app when it is all done. Pills and pairing are optional ("Lo haré luego"), so they are skipped.
 */
export async function nextFamilyRoute(userId: string): Promise<Href> {
  const { data: me } = await supabase
    .from('people')
    .select('family_id, display_name')
    .eq('user_id', userId)
    .eq('role', 'member')
    .limit(1)
    .maybeSingle();
  if (!me) return '/onboarding/name';

  const { data: senior } = await supabase
    .from('people')
    .select('id, display_name, talk_time')
    .eq('family_id', me.family_id)
    .eq('role', 'senior')
    .limit(1)
    .maybeSingle();
  if (!senior) return { pathname: '/onboarding/senior', params: { memberName: me.display_name } };
  if (!senior.talk_time) {
    return { pathname: '/onboarding/talk', params: { seniorId: senior.id, seniorName: senior.display_name } };
  }

  // TODO: family tabs (Hoy / Libro / Ajustes). Until then, Ajustes.
  return '/settings';
}
