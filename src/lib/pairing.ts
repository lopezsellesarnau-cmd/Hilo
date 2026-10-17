import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/** What the family's QR holds. Any 6 digits in a row are read back as the code. */
export const pairingLink = (code: string) => `hilo://pair?code=${code}`;
export const codeFromQr = (data: string) => data.match(/\d{6}/)?.[0] ?? null;

/**
 * The senior's phone: sign in anonymously and claim the family's code.
 * That links this phone to the senior row the family created.
 */
export async function pair(code: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // A family account on this phone (or on the simulator while testing) is signed out first
  if (session && !session.user.is_anonymous) await supabase.auth.signOut();
  if (!session || !session.user.is_anonymous) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error('offline');
  }
  const { data, error } = await supabase.rpc('claim_pairing_code', { pairing_code: code });
  if (error) throw new Error(error.message.includes('Already paired') ? 'paired' : 'code');
  return data as string;
}

export const PAIR_MESSAGES: Record<string, string> = {
  code: t.pairCode.badCode,
  paired: t.pairCode.alreadyPaired,
  offline: t.common.offline,
};
