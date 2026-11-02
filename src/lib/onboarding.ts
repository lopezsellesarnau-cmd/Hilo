import { isAuthApiError } from '@supabase/supabase-js';
import type { Href } from 'expo-router';

import { missing } from '@/lib/found';
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

  return '/family/today';
}

/**
 * Where the app should open, from the saved session:
 * nobody → Welcome, the senior's phone → their home (or consent first), family → nextFamilyRoute().
 */
export async function startRoute(): Promise<Href | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  // The saved session can belong to a user that no longer exists (e.g. after "Borrar cuenta"):
  // ask the server, and if it is gone, clear it and start from Welcome.
  // Offline is not "gone": then keep the session, or the senior would have to pair again.
  const { error } = await supabase.auth.getUser();
  if (error && isAuthApiError(error)) {
    await supabase.auth.signOut({ scope: 'local' });
    return null;
  }

  if (session.user.is_anonymous) {
    const found = await supabase.from('people').select('id').eq('user_id', session.user.id).maybeSingle();
    // An anonymous session without a person is a pairing that never finished
    if (missing(found)) return null;
    // No internet: her phone, so her Home (it says there's no connection), never Welcome
    if (!found.data) return '/home';
    const { count, error } = await supabase
      .from('consents')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', found.data.id)
      .is('revoked_at', null);
    return count || error ? '/home' : { pathname: '/consent', params: { personId: found.data.id } };
  }
  return nextFamilyRoute(session.user.id);
}
