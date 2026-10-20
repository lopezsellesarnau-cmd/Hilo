// Hilo: tells the family when the senior hasn't talked for 2 days, and nudges one of them to call
// when nobody in the family has talked with her for 3 days ("Llama a la abuela").
// Run every hour by Supabase Cron. At ALERT_HOUR in each senior's time zone it looks at their last talk
// (one where she answered) and, if it was 2 or more days ago, sends a push to every family phone.
// Otherwise it looks at the family's last call (family_calls: the "La he llamado" button or what she told
// Hilo) and, after 3 days, sends one push to the family member whose last call is the oldest.
// Straight to Apple (APNs) with the team's .p8 key: no push provider in between, one data processor less.
// At most one alert every 2 days while she stays quiet (people.quiet_alert_at).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

/** Local hour of the senior when the family is told: late afternoon, when there's still time to call */
const ALERT_HOUR = 19;
const QUIET_DAYS = 2;
/** Not again within this, even if she stays quiet */
const REPEAT_MS = 47 * 60 * 60 * 1000;
const CALL_DAYS = 3;
/** The call nudge: not again within this */
const CALL_REPEAT_MS = 71 * 60 * 60 * 1000;

const text = {
  es: (name: string, days: number) => `${name} lleva ${days} días sin charlar con Hilo. Quizá sea buen momento para llamar.`,
  en: (name: string, days: number) => `${name} hasn't chatted with Hilo for ${days} days. Maybe a good moment to call.`,
  nl: (name: string, days: number) =>
    `${name} heeft al ${days} dagen niet met Hilo gepraat. Misschien een goed moment om even te bellen.`,
};

const callText = {
  es: (name: string, days: number, note: string | null) =>
    `Hace ${days} días que nadie de la familia habla con ${name}.` + (note ? ` ${note}` : ' ¿Una llamada hoy?'),
  en: (name: string, days: number, note: string | null) =>
    `Nobody in the family has talked with ${name} for ${days} days.` + (note ? ` ${note}` : ' A call today?'),
  nl: (name: string, days: number, note: string | null) =>
    `Al ${days} dagen heeft niemand van de familie met ${name} gesproken.` + (note ? ` ${note}` : ' Vandaag even bellen?'),
};

/** "De qué hablar con ella" from her talks of the last days: gives the nudge something to call about */
const NOTE_DAYS = 4;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Date and hour in the senior's time zone */
function localNow(timeZone: string, date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

/** Whole days between two 'YYYY-MM-DD' */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** The JWT Apple asks for, signed with the .p8 key. Valid for an hour, so one per run. */
async function apnsToken() {
  const key = await importPKCS8(Deno.env.get('APNS_KEY')!.replaceAll('\\n', '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID')! })
    .setIssuer(Deno.env.get('APNS_TEAM_ID')!)
    .setIssuedAt()
    .sign(key);
}

/**
 * Sends one alert. TestFlight and App Store phones use Apple's production server,
 * development builds the sandbox one: try production first, then sandbox.
 * Returns 'gone' when Apple says the token is dead (app deleted), so it can be removed.
 */
async function sendPush(jwt: string, token: string, body: string, url = '/family/today'): Promise<'sent' | 'gone' | 'failed'> {
  const payload = JSON.stringify({
    aps: { alert: { title: 'Hilo', body }, sound: 'default' },
    // expo-notifications reads the data from "body"; tapping it opens Hoy (or Charlas, for the call nudge)
    body: { url },
  });
  for (const host of ['api.push.apple.com', 'api.sandbox.push.apple.com']) {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-topic': Deno.env.get('APNS_TOPIC') ?? 'com.arnolop.hilo',
        'apns-push-type': 'alert',
        'apns-priority': '10',
      },
      body: payload,
    });
    if (res.ok) return 'sent';
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason;
    if (res.status === 410 || reason === 'Unregistered') return 'gone';
    // A sandbox token on the production server, or the other way round: try the other one
    if (reason === 'BadDeviceToken') continue;
    console.error('apns', host, res.status, reason);
    return 'failed';
  }
  return 'gone';
}

type Admin = SupabaseClient;
type SeniorRow = {
  id: string;
  family_id: string;
  display_name: string;
  timezone: string;
  quiet_alert_at: string | null;
  call_alert_at: string | null;
};

/** The day her phone was connected (her first consent): the count starts there when nothing happened yet */
async function connectedAt(admin: Admin, seniorId: string): Promise<string | null> {
  const { data } = await admin
    .from('consents')
    .select('granted_at')
    .eq('person_id', seniorId)
    .order('granted_at')
    .limit(1)
    .maybeSingle();
  return (data?.granted_at as string | undefined) ?? null;
}

/** Sends to these phones, removing dead tokens. True if at least one got it. */
async function sendAll(
  admin: Admin,
  jwt: string,
  tokens: { token: string; locale: string }[],
  body: (locale: string) => string,
  url?: string,
) {
  let any = false;
  for (const { token, locale } of tokens) {
    const result = await sendPush(jwt, token, body(locale), url);
    if (result === 'sent') any = true;
    if (result === 'gone') await admin.from('push_tokens').delete().eq('token', token);
  }
  return any;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Only Supabase Cron (or Arnau testing) knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'auth' }, 401);
  /**
   * test: ignore the hour and the days, to try it now. Never from the cron.
   * email (only with test): send only to the family phones of this account, not to every family.
   * kind (only with test): 'quiet' (default) or 'call', the alert to try.
   */
  const {
    test = false,
    email,
    kind = 'quiet',
  } = (await req.json().catch(() => ({}))) as { test?: boolean; email?: string; kind?: 'quiet' | 'call' };

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let query = admin
    .from('people')
    .select('id, family_id, display_name, timezone, quiet_alert_at, call_alert_at')
    .eq('role', 'senior')
    .not('user_id', 'is', null);
  if (test && email) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) return json({ error: 'no_user' }, 404);
    const { data: mine } = await admin.from('people').select('family_id').eq('user_id', user.id).eq('role', 'member');
    query = query.in(
      'family_id',
      (mine ?? []).map((m) => m.family_id),
    );
  }
  const { data: seniors, error } = await query;
  if (error) return json({ error: 'people' }, 500);

  let jwt: string | null = null;
  const sent: string[] = [];
  const nudged: string[] = [];

  for (const s of (seniors ?? []) as SeniorRow[]) {
    const now = localNow(s.timezone);
    if (!test && now.hour !== ALERT_HOUR) continue;

    // ── She hasn't talked with Hilo: every family phone ──
    if (!test || kind === 'quiet') {
      const recent = s.quiet_alert_at && Date.now() - Date.parse(s.quiet_alert_at) < REPEAT_MS;
      // Her last real talk: more than Hilo's greeting, she answered at least once
      const { data: talks } = await admin
        .from('talk_sessions')
        .select('started_at, turns(count)')
        .eq('person_id', s.id)
        .order('started_at', { ascending: false })
        .limit(20);
      const last = (talks ?? []).find((t) => ((t.turns as { count: number }[])[0]?.count ?? 0) > 1)?.started_at;
      // Never talked yet: count from the day her phone was connected
      const since = last ?? (await connectedAt(admin, s.id));
      const days = since ? daysBetween(localNow(s.timezone, new Date(since)).date, now.date) : 0;

      if (since && (test || (!recent && days >= QUIET_DAYS))) {
        const { data: tokens } = await admin.from('push_tokens').select('token, locale').eq('family_id', s.family_id);
        if (tokens?.length) {
          jwt ??= await apnsToken();
          const any = await sendAll(admin, jwt, tokens, (locale) =>
            (text[locale as keyof typeof text] ?? text.es)(s.display_name, Math.max(days, QUIET_DAYS)),
          );
          if (any) {
            // A test doesn't count, or the real alert would wait 2 days
            if (!test) await admin.from('people').update({ quiet_alert_at: new Date().toISOString() }).eq('id', s.id);
            sent.push(s.id);
          }
        }
      }
      // One alert per evening at most: the call nudge waits for another day
      if (test || sent.includes(s.id) || (since && days >= QUIET_DAYS)) continue;
    }

    // ── Nobody in the family has talked with her: one family member ──
    if (!test && s.call_alert_at && Date.now() - Date.parse(s.call_alert_at) < CALL_REPEAT_MS) continue;
    const { data: calls } = await admin
      .from('family_calls')
      .select('member_id, called_at')
      .eq('senior_id', s.id)
      .order('called_at', { ascending: false })
      .limit(200);
    const since = calls?.[0]?.called_at ?? (await connectedAt(admin, s.id));
    if (!since) continue;
    const days = daysBetween(localNow(s.timezone, new Date(since)).date, now.date);
    if (!test && days < CALL_DAYS) continue;

    const { data: noted } = await admin
      .from('talk_sessions')
      .select('family_note')
      .eq('person_id', s.id)
      .not('family_note', 'is', null)
      .gte('started_at', new Date(Date.now() - NOTE_DAYS * 86_400_000).toISOString())
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const note = (noted?.family_note as string | undefined) ?? null;

    // Whoever called least recently (or never), among those with Hilo on a phone
    const { data: members } = await admin
      .from('people')
      .select('id, user_id')
      .eq('family_id', s.family_id)
      .eq('role', 'member')
      .not('user_id', 'is', null);
    const lastCall = (id: string) => calls?.find((c) => c.member_id === id)?.called_at ?? '';
    const order = (members ?? []).sort((a, b) => lastCall(a.id).localeCompare(lastCall(b.id)));
    for (const m of order) {
      const { data: tokens } = await admin.from('push_tokens').select('token, locale').eq('user_id', m.user_id);
      if (!tokens?.length) continue;
      jwt ??= await apnsToken();
      const any = await sendAll(
        admin,
        jwt,
        tokens,
        (locale) => (callText[locale as keyof typeof callText] ?? callText.es)(s.display_name, Math.max(days, CALL_DAYS), note),
        // Straight to Charlas, where the "He hablado hoy con…" button is
        '/family/talks',
      );
      if (!any) continue;
      if (!test) await admin.from('people').update({ call_alert_at: new Date().toISOString() }).eq('id', s.id);
      nudged.push(s.id);
      break;
    }
  }

  return json({ sent: sent.length, nudged: nudged.length });
});
