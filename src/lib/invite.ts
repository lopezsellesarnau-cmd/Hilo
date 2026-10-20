import { t } from '@/i18n';
import { TERMS_VERSION } from '@/lib/legal';
import { supabase } from '@/lib/supabase';

/** What the invite QR holds. Any 8 digits in a row are read back as the code. */
export const inviteLink = (code: string) => `hilo://join?code=${code}`;
export const codeFromInviteQr = (data: string) => data.match(/\d{8}/)?.[0] ?? null;
/** '12345678' → '1234 5678' */
export const showInviteCode = (code: string) => `${code.slice(0, 4)} ${code.slice(4)}`;

/** The family's invite code (a new one each time: the old one stops working) */
export async function createInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_family_invite');
  if (error?.message.includes('Family plan')) throw new Error('plan');
  if (error || !data) throw new Error('offline');
  return data as string;
}

/**
 * A family member signed in with their email joins the family of this code.
 * Keeps a record of the terms they accepted on the email step, like the one who created the family.
 */
export async function joinFamily(code: string, memberName: string) {
  const { data: familyId, error } = await supabase.rpc('join_family', { invite_code: code, member_name: memberName });
  if (error) {
    if (error.message.includes('Already')) throw new Error('already');
    if (error.message.includes('Too many')) throw new Error('many');
    if (error.message.includes('Family plan')) throw new Error('plan');
    throw new Error('offline');
  }
  if (!familyId) throw new Error('code');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from('people')
    .select('id')
    .eq('family_id', familyId)
    .eq('user_id', user?.id ?? '')
    .single();
  // Joined already: a failed record of the terms must not stop them
  if (me)
    await supabase.from('consents').insert({ family_id: familyId, person_id: me.id, kind: 'terms', version: TERMS_VERSION });
}

export const JOIN_MESSAGES: Record<string, string> = {
  code: t.join.badCode,
  already: t.join.already,
  many: t.join.tooMany,
  plan: t.join.noPlan,
  offline: t.common.offline,
};
