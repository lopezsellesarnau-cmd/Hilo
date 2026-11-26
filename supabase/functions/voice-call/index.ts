// Hilo: the family calls her, voice to voice, inside Hilo (plan: vault Senior-App/12-llamadas-plan, piece 1).
//  start (a family member): a row in voice_calls, her iPhone rings (VoIP push → CallKit, with the caller's name),
//         and the caller gets a token for the LiveKit room (the room is the call's id; LiveKit makes it on first join)
//  join  (her phone, after she answers): marks it active and gives her a token for the same room
//  end   (either): she declined, nobody answered, or someone hung up
// LiveKit Cloud (EU) carries the audio and records nothing. Secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
// Tokens are LiveKit's JWT (HS256), signed here with jose: no server SDK. One file, like the other functions.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

/** How long a call can ring before it counts as not answered */
const RING_MS = 45 * 1000;
/** A token is only for joining; once in, the call can last */
const TOKEN_SECONDS = 2 * 60 * 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A LiveKit access token for one room: speak and listen, nothing else */
async function roomToken(room: string, identity: string, name: string) {
  const secret = new TextEncoder().encode(Deno.env.get('LIVEKIT_API_SECRET')!);
  return new SignJWT({ name, video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(Deno.env.get('LIVEKIT_API_KEY')!)
    .setSubject(identity)
    .setNotBefore(Math.floor(Date.now() / 1000) - 10)
    .setExpirationTime(Math.floor(Date.now() / 1000) + TOKEN_SECONDS)
    .sign(secret);
}

/** The JWT Apple asks for, signed with the .p8 key (as in ring) */
async function apnsToken() {
  const key = await importPKCS8(Deno.env.get('APNS_KEY')!.replaceAll('\\n', '\n'), 'ES256');
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! }).setIssuer(Deno.env.get('APNS_TEAM_ID')!).setIssuedAt().sign(key);
}

/** The VoIP push that makes her phone ring (as in ring): production first, then sandbox */
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
        // A sleeping phone may be offline for a moment: Apple keeps trying for 30 s, then drops it
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 30),
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
  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  if (!livekitUrl || !Deno.env.get('LIVEKIT_API_KEY') || !Deno.env.get('LIVEKIT_API_SECRET')) return json({ error: 'not_configured' }, 503);

  const body = (await req.json().catch(() => ({}))) as { action?: string; call_id?: string; reason?: string };
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData } = await db.auth.getUser(auth.replace('Bearer ', ''));
  const userId = userData.user?.id;
  if (!userId) return json({ error: 'auth' }, 401);
  // Who is asking: a family member or her (RLS shows a person only their own row and family)
  const { data: me } = await db.from('people').select('id, family_id, role, display_name').eq('user_id', userId).maybeSingle();
  if (!me) return json({ error: 'not_family' }, 403);

  // ── start: a family member calls her ──
  if (body.action === 'start') {
    if (me.role !== 'member') return json({ error: 'not_member' }, 403);
    const { data: senior } = await admin.from('people').select('id').eq('family_id', me.family_id).eq('role', 'senior').maybeSingle();
    const { data: phone } = senior ? await admin.from('voip_tokens').select('token').eq('person_id', senior.id).maybeSingle() : { data: null };
    if (!senior || !phone) return json({ error: 'no_phone' }, 409);
    // Already on a call (or ringing) with someone in the family
    const { count } = await admin
      .from('voice_calls')
      .select('id', { count: 'exact', head: true })
      .eq('senior_id', senior.id)
      .in('status', ['ringing', 'active'])
      .gte('created_at', new Date(Date.now() - TOKEN_SECONDS * 1000).toISOString());
    if (count) return json({ error: 'busy' }, 429);

    const { data: call, error } = await admin.from('voice_calls').insert({ family_id: me.family_id, senior_id: senior.id, caller_id: me.id }).select('id').single();
    if (error || !call) return json({ error: 'save' }, 500);
    // kind 'voice': on her phone, answering joins this call instead of opening the talk with Hilo
    const result = await ringPhone(phone.token, { uuid: call.id, caller: me.display_name, kind: 'voice' });
    if (result !== 'sent') {
      await admin.from('voice_calls').delete().eq('id', call.id);
      if (result === 'gone') await admin.from('voip_tokens').delete().eq('person_id', senior.id);
      return json({ error: result === 'gone' ? 'no_phone' : 'failed' }, result === 'gone' ? 409 : 502);
    }
    return json({ call_id: call.id, url: livekitUrl, token: await roomToken(call.id, `member-${me.id}`, me.display_name) });
  }

  if (!body.call_id || !UUID.test(body.call_id)) return json({ error: 'call' }, 400);
  const { data: call } = await admin.from('voice_calls').select('id, family_id, senior_id, caller_id, status, created_at').eq('id', body.call_id).maybeSingle();
  if (!call || call.family_id !== me.family_id) return json({ error: 'call' }, 404);

  // ── join: she answered on her phone ──
  if (body.action === 'join') {
    if (call.senior_id !== me.id) return json({ error: 'not_her' }, 403);
    const fresh = Date.now() - Date.parse(call.created_at) < RING_MS + 15_000;
    if (call.status === 'ringing' && !fresh) return json({ error: 'gone' }, 410);
    if (call.status !== 'ringing' && call.status !== 'active') return json({ error: 'gone' }, 410);
    if (call.status === 'ringing') await admin.from('voice_calls').update({ status: 'active', answered_at: new Date().toISOString() }).eq('id', call.id).eq('status', 'ringing');
    return json({ url: livekitUrl, token: await roomToken(call.id, `senior-${me.id}`, me.display_name) });
  }

  // ── end: declined, not answered, or hung up ──
  if (body.action === 'end') {
    if (call.status === 'ended' || call.status === 'missed' || call.status === 'declined') return json({ status: call.status });
    const status = call.status === 'active' ? 'ended' : me.id === call.senior_id ? 'declined' : 'missed';
    await admin.from('voice_calls').update({ status, ended_at: new Date().toISOString() }).eq('id', call.id).in('status', ['ringing', 'active']);
    return json({ status });
  }

  return json({ error: 'action' }, 400);
});
