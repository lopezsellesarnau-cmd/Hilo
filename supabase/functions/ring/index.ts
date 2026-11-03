// Hilo: the family presses "Llamar ahora" and Hilo rings on the senior's iPhone like a call.
// Sends a VoIP push straight to Apple (APNs, same .p8 key as quiet-alert); the app shows it with CallKit
// (modules/hilo-voip) and opens the talk when she answers. The call is kept in rings, so the family sees it.
// Called from the family's phone or browser, so it answers CORS. One file, so it can be pasted in the Dashboard editor.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

/** At most one call this often, so she isn't rung again and again */
const GAP_MS = 30 * 60 * 1000;

/** The name on the call, in her language (as in the app's talk.caller) */
const CALLER = { es: 'Hilo, tu charla', en: 'Hilo, your chat', nl: 'Hilo, je gesprek' } as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** The JWT Apple asks for, signed with the .p8 key (as in quiet-alert) */
async function apnsToken() {
  const key = await importPKCS8(Deno.env.get('APNS_KEY')!.replaceAll('\\n', '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! })
    .setIssuer(Deno.env.get('APNS_TEAM_ID')!)
    .setIssuedAt()
    .sign(key);
}

/**
 * The VoIP push. TestFlight and App Store phones use Apple's production server, development builds
 * the sandbox one: try production first. 'gone' when the token is dead (app deleted or a new phone).
 */
async function ringPhone(token: string, payload: object): Promise<'sent' | 'gone' | 'failed'> {
  const jwt = await apnsToken();
  for (const host of ['api.push.apple.com', 'api.sandbox.push.apple.com']) {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': `${Deno.env.get('APNS_TOPIC') ?? 'com.arnolop.hilo'}.voip`,
        'apns-push-type': 'voip',
        'apns-priority': '10',
        // A call that couldn't ring now is not delivered later
        'apns-expiration': '0',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return 'sent';
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
    if (res.status === 410 || reason === 'Unregistered') return 'gone';
    if (reason === 'BadDeviceToken') continue;
    console.error('apns', host, res.status, reason);
    return 'failed';
  }
  return 'gone';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'auth' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // The family member pressing the button, and their senior
  const { data: userData } = await db.auth.getUser(auth.replace('Bearer ', ''));
  const userId = userData.user?.id;
  const { data: member } = await db
    .from('people')
    .select('family_id')
    .eq('user_id', userId ?? '')
    .eq('role', 'member')
    .maybeSingle();
  if (!userId || !member) return json({ error: 'not_member' }, 403);
  const { data: senior } = await admin
    .from('people')
    .select('id, locale')
    .eq('family_id', member.family_id)
    .eq('role', 'senior')
    .maybeSingle();
  const { data: phone } = senior
    ? await admin.from('voip_tokens').select('token').eq('person_id', senior.id).maybeSingle()
    : { data: null };
  if (!senior || !phone) return json({ error: 'no_phone' }, 409);

  const { count } = await admin
    .from('rings')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', senior.id)
    .gte('created_at', new Date(Date.now() - GAP_MS).toISOString());
  if (count) return json({ error: 'too_soon' }, 429);

  const { data: ring, error } = await admin
    .from('rings')
    .insert({ person_id: senior.id, family_id: member.family_id, asked_by: userId })
    .select('id')
    .single();
  if (error) return json({ error: 'save' }, 500);

  const caller = CALLER[senior.locale as keyof typeof CALLER] ?? CALLER.es;
  const result = await ringPhone(phone.token, { uuid: ring.id, caller });
  if (result === 'sent') return json({ ring_id: ring.id });

  // It never rang: no call to count, so the family can try again
  await admin.from('rings').delete().eq('id', ring.id);
  if (result === 'gone') await admin.from('voip_tokens').delete().eq('person_id', senior.id);
  return json({ error: result === 'gone' ? 'no_phone' : 'failed' }, result === 'gone' ? 409 : 502);
});
