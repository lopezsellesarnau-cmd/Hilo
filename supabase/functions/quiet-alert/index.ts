// Hilo: tells the family when the senior hasn't talked for 2 days.
// Run every hour by Supabase Cron. At ALERT_HOUR in each senior's time zone it looks at their last talk
// (one where she answered) and, if it was 2 or more days ago, sends a push to every family phone.
// Straight to Apple (APNs) with the team's .p8 key: no push provider in between, one data processor less.
// At most one alert every 2 days while she stays quiet (people.quiet_alert_at).

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

/** Local hour of the senior when the family is told: late afternoon, when there's still time to call */
const ALERT_HOUR = 19;
const QUIET_DAYS = 2;
/** Not again within this, even if she stays quiet */
const REPEAT_MS = 47 * 60 * 60 * 1000;

const text = {
  es: (name: string, days: number) => `${name} lleva ${days} días sin charlar con Hilo. Quizá sea buen momento para llamar.`,
  en: (name: string, days: number) => `${name} hasn't chatted with Hilo for ${days} days. Maybe a good moment to call.`,
  nl: (name: string, days: number) =>
    `${name} heeft al ${days} dagen niet met Hilo gepraat. Misschien een goed moment om even te bellen.`,
};

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
async function sendPush(jwt: string, token: string, body: string): Promise<'sent' | 'gone' | 'failed'> {
  const payload = JSON.stringify({
    aps: { alert: { title: 'Hilo', body }, sound: 'default' },
    // expo-notifications reads the data from "body"; tapping it opens Hoy
    body: { url: '/family/today' },
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Only Supabase Cron (or Arnau testing) knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'auth' }, 401);
  /** test: ignore the hour and the 2 days, to try it now. Never from the cron. */
  const { test = false } = (await req.json().catch(() => ({}))) as { test?: boolean };

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: seniors, error } = await admin
    .from('people')
    .select('id, family_id, display_name, timezone, quiet_alert_at')
    .eq('role', 'senior')
    .not('user_id', 'is', null);
  if (error) return json({ error: 'people' }, 500);

  let jwt: string | null = null;
  const sent: string[] = [];

  for (const s of seniors ?? []) {
    const now = localNow(s.timezone);
    if (!test && now.hour !== ALERT_HOUR) continue;
    if (!test && s.quiet_alert_at && Date.now() - Date.parse(s.quiet_alert_at) < REPEAT_MS) continue;

    // Her last real talk: more than Hilo's greeting, she answered at least once
    const { data: talks } = await admin
      .from('talk_sessions')
      .select('started_at, turns(count)')
      .eq('person_id', s.id)
      .order('started_at', { ascending: false })
      .limit(20);
    const last = (talks ?? []).find((t) => ((t.turns as { count: number }[])[0]?.count ?? 0) > 1)?.started_at;
    // Never talked yet: count from the day her phone was connected (her consent)
    const since =
      last ??
      (
        await admin
          .from('consents')
          .select('granted_at')
          .eq('person_id', s.id)
          .order('granted_at')
          .limit(1)
          .maybeSingle()
      ).data?.granted_at;
    if (!since) continue;

    const days = daysBetween(localNow(s.timezone, new Date(since)).date, now.date);
    if (!test && days < QUIET_DAYS) continue;

    const { data: tokens } = await admin.from('push_tokens').select('token, locale').eq('family_id', s.family_id);
    if (!tokens?.length) continue;

    jwt ??= await apnsToken();
    let any = false;
    for (const { token, locale } of tokens) {
      const say = text[locale as keyof typeof text] ?? text.es;
      const result = await sendPush(jwt, token, say(s.display_name, Math.max(days, QUIET_DAYS)));
      if (result === 'sent') any = true;
      if (result === 'gone') await admin.from('push_tokens').delete().eq('token', token);
    }
    if (!any) continue;
    // A test doesn't count, or the real alert would wait 2 days
    if (!test) await admin.from('people').update({ quiet_alert_at: new Date().toISOString() }).eq('id', s.id);
    sent.push(s.id);
  }

  return json({ sent: sent.length });
});
