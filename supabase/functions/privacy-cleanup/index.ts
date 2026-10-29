// Hilo: deletes what must not be kept. Run every hour by Supabase Cron (same secret as quiet-alert).
// Today: the recordings of "Escuchar mi historia" whose chapter was discarded, taken back to draft or
// deleted with the account. Within an hour of the family deleting something, its audio is gone too.
// Also the anonymous accounts of pairings that never finished (wrong code), after 7 days, and her talks word
// for word 90 days after each talk.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const BUCKET = 'chapter-audio';
/** Storage removes at most this many files per call */
const BATCH = 100;

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Only Supabase Cron (or Arnau testing) knows this secret
  if (!(await sameSecret(req.headers.get('x-cron-secret'), Deno.env.get('CRON_SECRET')))) return json({ error: 'auth' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: paths, error } = await admin.rpc('orphan_chapter_audio');
  if (error) {
    console.error('list', error.message);
    return json({ error: 'list' }, 500);
  }

  const files = (paths ?? []) as string[];
  let deleted = 0;
  for (let i = 0; i < files.length; i += BATCH) {
    const { data, error: e } = await admin.storage.from(BUCKET).remove(files.slice(i, i + BATCH));
    if (e) console.error('remove', e.message);
    else deleted += data?.length ?? 0;
  }

  const { data: users, error: u } = await admin.rpc('delete_orphan_anonymous_users');
  if (u) console.error('anonymous', u.message);
  const { data: turns, error: t } = await admin.rpc('delete_old_turns');
  if (t) console.error('turns', t.message);
  return json({ found: files.length, deleted, anonymous: users ?? null, turns: turns ?? null });
});
