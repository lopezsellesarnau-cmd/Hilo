// Hilo: RevenueCat tells us something changed in a family's subscription (trial, renewal, cancellation…).
// Instead of reading each event type, it asks RevenueCat for the family's current state and saves it:
// events can arrive late or out of order, the current state can't.
// The RevenueCat app user id is the family_id (the app logs in with it).

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Compares secrets in constant time (hashing first hides the length too). False if either is empty. */
async function sameSecret(given: string | null | undefined, expected: string | null | undefined) {
  if (!given || !expected) return false;
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Entitlement = { expires_date: string | null; product_identifier: string };
type Subscription = { period_type: string; expires_date: string | null };

const active = (e?: Entitlement) => Boolean(e && (!e.expires_date || Date.parse(e.expires_date) > Date.now()));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // The value set in RevenueCat → Integrations → Webhooks → Authorization header, with or without "Bearer "
  const bare = (v: string | null | undefined) => (v ?? '').trim().replace(/^Bearer\s+/i, '');
  const expected = bare(Deno.env.get('REVENUECAT_WEBHOOK_SECRET'));
  if (!(await sameSecret(bare(req.headers.get('Authorization')), expected))) {
    console.error('auth: the Authorization header does not match REVENUECAT_WEBHOOK_SECRET');
    return json({ error: 'auth' }, 401);
  }

  const { event } = (await req.json().catch(() => ({}))) as { event?: { app_user_id?: string; type?: string } };
  const familyId = event?.app_user_id;
  // Anonymous RevenueCat users (before the app logged in) and test pings have nothing to save
  if (!familyId || !UUID.test(familyId)) return json({ skipped: event?.type ?? 'no event' });

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(familyId)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get('REVENUECAT_SECRET_KEY')}` },
  });
  if (!res.ok) {
    console.error('revenuecat', res.status, await res.text());
    // RevenueCat retries the webhook when it doesn't get a 200
    return json({ error: 'revenuecat' }, 502);
  }
  const { subscriber } = (await res.json()) as {
    subscriber: { entitlements: Record<string, Entitlement>; subscriptions: Record<string, Subscription> };
  };

  // Familia includes everything in Básico
  const family = subscriber.entitlements.family;
  const basic = subscriber.entitlements.basic;
  const current = active(family) ? family : active(basic) ? basic : (family ?? basic);
  const plan = current === family && family ? 'family' : 'basic';
  const sub = current ? subscriber.subscriptions[current.product_identifier] : undefined;
  const status = !active(current) ? 'expired' : sub?.period_type === 'trial' ? 'trial' : 'active';

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: fam } = await admin.from('families').select('id').eq('id', familyId).maybeSingle();
  if (!fam) return json({ skipped: 'unknown family' });

  const { error } = await admin.from('subscriptions').upsert({
    family_id: familyId,
    plan,
    status,
    expires_at: current?.expires_date ?? null,
    product_id: current?.product_identifier ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error('subscriptions', error.message);
    return json({ error: 'save' }, 500);
  }
  return json({ saved: status, plan });
});
