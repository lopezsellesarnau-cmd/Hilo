// Hilo: Hilo calls her at her chat time (plan: vault Senior-App/12-llamadas-plan, piece 2).
// Run every minute by Supabase Cron (same secret as quiet-alert). Three jobs, in order:
//  1. Her chat time is now (her time zone), she has a phone that rings, she hasn't talked today and Hilo hasn't
//     rung today: ring like a call (VoIP push → CallKit on her iPhone; answering opens the talk).
//  2. Rang 10 minutes ago, not answered and no talk since: ring once more.
//  3. Rang twice, 10 minutes since the second, still nothing: mark it missed and tell the family.
// Only rings made here (rings.scheduled); the family's "Call" button keeps its own rules. One file, as the others.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

/** Wait this long for her to answer before trying again, and again before telling the family */
const RETRY_MS = 10 * 60 * 1000;
/** The cron can run a little late: a chat time up to this many minutes ago still rings */
const WINDOW_MIN = 4;
/** Not one ring from the family's button within this before the chat time either */
const GAP_MS = 30 * 60 * 1000;

/** The name on the call, in her language (as in ring) */
const CALLER = { es: 'Hilo, tu charla', en: 'Hilo, your chat', nl: 'Hilo, je gesprek' } as const;
/** The family's alert when she didn't answer twice */
const MISSED = {
  es: (name: string, time: string) => `${name} no ha contestado a Hilo a las ${time}, ni 10 minutos después. Quizá sea buen momento para llamarla.`,
  en: (name: string, time: string) => `${name} didn't answer Hilo at ${time}, nor 10 minutes later. Maybe a good moment to call.`,
  nl: (name: string, time: string) => `${name} nam niet op toen Hilo om ${time} belde, ook niet 10 minuten later. Misschien een goed moment om te bellen.`,
} as const;
type Lang = keyof typeof CALLER;
const lang = (l: string | null | undefined): Lang => (l === 'en' || l === 'nl' ? l : 'es');

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Compares secrets in constant time (hashing first hides the length too). False if either is empty. */
async function sameSecret(given: string | null | undefined, expected: string | null | undefined) {
  if (!given || !expected) return false;
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Now in her time zone: 'YYYY-MM-DD' and minutes since midnight */
function local(timeZone: string, date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The JWT Apple asks for, signed with the .p8 key. One per run. */
async function apnsToken() {
  const key = await importPKCS8(Deno.env.get('APNS_KEY')!.replaceAll('\\n', '\n'), 'ES256');
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! }).setIssuer(Deno.env.get('APNS_TEAM_ID')!).setIssuedAt().sign(key);
}

/** One push to Apple, production first, then sandbox. 'gone' when the token is dead. */
async function apns(jwt: string, token: string, kind: 'voip' | 'alert', payload: object): Promise<'sent' | 'gone' | 'failed'> {
  const topic = Deno.env.get('APNS_TOPIC') ?? 'com.arnolop.hilo';
  for (const host of ['api.push.apple.com', 'api.sandbox.push.apple.com']) {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': kind === 'voip' ? `${topic}.voip` : topic,
        'apns-push-type': kind,
        'apns-priority': '10',
        // A locked, sleeping phone may be offline for a moment: Apple keeps trying for 30 s, then drops it
        ...(kind === 'voip' ? { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 30) } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return 'sent';
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
    if (res.status === 410 || reason === 'Unregistered') return 'gone';
    if (reason === 'BadDeviceToken') continue;
    console.error('apns', kind, host, res.status, reason);
    return 'failed';
  }
  return 'gone';
}

type Senior = { id: string; family_id: string; display_name: string; timezone: string; locale: string; talk_time: string };

/** Rings her phone for this ring row; forgets a dead token */
async function ring(admin: SupabaseClient, jwt: string, senior: Pick<Senior, 'id' | 'locale'>, ringId: string) {
  const { data: phone } = await admin.from('voip_tokens').select('token').eq('person_id', senior.id).maybeSingle();
  if (!phone) return 'gone' as const;
  const result = await apns(jwt, phone.token, 'voip', { uuid: ringId, caller: CALLER[lang(senior.locale)] });
  if (result === 'gone') await admin.from('voip_tokens').delete().eq('person_id', senior.id);
  return result;
}

/** She talked with Hilo after this moment (answering opens the talk; she may also have opened it herself) */
async function talkedSince(admin: SupabaseClient, seniorId: string, since: string) {
  const { count } = await admin.from('talk_sessions').select('id', { count: 'exact', head: true }).eq('person_id', seniorId).gte('started_at', since);
  return Boolean(count);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!(await sameSecret(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET')))) return json({ error: 'auth' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let jwt: string | null = null;
  const token = async () => (jwt ??= await apnsToken());
  const done = { rang: 0, retried: 0, missed: 0 };

  // 1. Chat time now: Hilo rings
  const { data: seniors } = await admin
    .from('people')
    .select('id, family_id, display_name, timezone, locale, talk_time')
    .eq('role', 'senior')
    .eq('hilo_calls', true)
    .not('talk_time', 'is', null)
    .not('user_id', 'is', null);
  for (const s of (seniors ?? []) as Senior[]) {
    const now = local(s.timezone);
    const [h, m] = s.talk_time.split(':').map(Number);
    const late = now.minutes - (h * 60 + m);
    if (late < 0 || late > WINDOW_MIN) continue;
    // Her day so far: a talk already, or Hilo already rang today (her local midnight, roughly: the last 20 hours)
    const dayStart = new Date(Date.now() - (now.minutes + 1) * 60_000).toISOString();
    if (await talkedSince(admin, s.id, dayStart)) continue;
    const { count: rangToday } = await admin.from('rings').select('id', { count: 'exact', head: true }).eq('person_id', s.id).eq('scheduled', true).gte('created_at', dayStart);
    if (rangToday) continue;
    const { count: recent } = await admin
      .from('rings')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', s.id)
      .gte('created_at', new Date(Date.now() - GAP_MS).toISOString());
    if (recent) continue;
    const { data: row } = await admin.from('rings').insert({ person_id: s.id, family_id: s.family_id, scheduled: true }).select('id').single();
    if (!row) continue;
    const result = await ring(admin, await token(), s, row.id);
    if (result === 'sent') done.rang++;
    else await admin.from('rings').delete().eq('id', row.id); // it never rang: nothing to retry
  }

  // 2 and 3. Rings of today still unanswered after 10 minutes
  const { data: waiting } = await admin
    .from('rings')
    .select('id, person_id, family_id, attempts, rang_at, created_at')
    .eq('status', 'ringing')
    .eq('scheduled', true)
    .lt('rang_at', new Date(Date.now() - RETRY_MS).toISOString())
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  for (const r of waiting ?? []) {
    const { data: s } = await admin.from('people').select('id, display_name, timezone, locale, talk_time').eq('id', r.person_id).maybeSingle();
    if (!s) continue;
    // She opened the talk some other way: as good as answered
    if (await talkedSince(admin, r.person_id, r.created_at)) {
      await admin.from('rings').update({ status: 'answered', answered_at: new Date().toISOString() }).eq('id', r.id);
      continue;
    }
    if (r.attempts < 2) {
      await admin.from('rings').update({ attempts: 2, rang_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'ringing');
      if ((await ring(admin, await token(), s, r.id)) === 'sent') done.retried++;
      continue;
    }
    // Twice and nothing: the family is told, once
    const { data: marked } = await admin.from('rings').update({ status: 'missed' }).eq('id', r.id).eq('status', 'ringing').select('id');
    if (!marked?.length) continue;
    done.missed++;
    const time = String(s.talk_time ?? '').slice(0, 5).replace(/^0/, '');
    const { data: tokens } = await admin.from('push_tokens').select('token, locale').eq('family_id', r.family_id);
    for (const t of tokens ?? []) {
      const result = await apns(await token(), t.token, 'alert', {
        aps: { alert: { title: 'Hilo', body: MISSED[lang(t.locale)](s.display_name, time) }, sound: 'default' },
        body: { url: '/family/today' },
      });
      if (result === 'gone') await admin.from('push_tokens').delete().eq('token', t.token);
    }
  }

  return json(done);
});
