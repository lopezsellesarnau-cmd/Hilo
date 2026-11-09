import { supabase } from '@/lib/supabase';

/** What she asked Hilo to send in a talk ("dile a Pedro que…"), or an alert after a fall or feeling unwell */
export type FamilyMessage = {
  id: string;
  body: string;
  kind: 'message' | 'alert';
  at: string;
  forEveryone: boolean;
  unread: boolean;
};

/** How far back Familia shows her messages */
const DAYS = 14;

/** The member on this phone: their messages are the ones sent to them or to the whole family */
async function myMemberId(): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const { data } = await supabase
    .from('people')
    .select('id')
    .eq('user_id', session.session?.user.id ?? '')
    .eq('role', 'member')
    .maybeSingle();
  return data?.id ?? null;
}

/** Her messages to me or to everyone, newest first. A message to a brother stays his. */
export async function loadMessages(seniorId: string): Promise<FamilyMessage[]> {
  const me = await myMemberId();
  if (!me) return [];
  const { data, error } = await supabase
    .from('family_messages')
    .select('id, body, kind, created_at, recipient_id, read_at')
    .eq('senior_id', seniorId)
    .or(`recipient_id.eq.${me},recipient_id.is.null`)
    .gte('created_at', new Date(Date.now() - DAYS * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    kind: m.kind,
    at: m.created_at,
    forEveryone: m.recipient_id === null,
    unread: m.read_at === null,
  }));
}

/** For the badge on Familia */
export async function unreadMessages(seniorId: string): Promise<number> {
  const me = await myMemberId();
  if (!me) return 0;
  const { count } = await supabase
    .from('family_messages')
    .select('id', { count: 'exact', head: true })
    .eq('senior_id', seniorId)
    .or(`recipient_id.eq.${me},recipient_id.is.null`)
    .is('read_at', null);
  return count ?? 0;
}

/** Opening Familia reads them */
export async function markMessagesRead(seniorId: string) {
  const { error } = await supabase.rpc('read_family_messages', { senior: seniorId });
  if (error) throw error;
}
