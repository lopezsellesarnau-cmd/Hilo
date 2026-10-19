// Hilo: deletes what must not be kept. Run every hour by Supabase Cron (same secret as quiet-alert).
// Today: the recordings of "Escuchar mi historia" whose chapter was discarded, taken back to draft or
// deleted with the account. Within an hour of the family deleting something, its audio is gone too.

import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const BUCKET = 'chapter-audio';
/** Storage removes at most this many files per call */
const BATCH = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Only Supabase Cron (or Arnau testing) knows this secret
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'auth' }, 401);

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
  return json({ found: files.length, deleted });
});
