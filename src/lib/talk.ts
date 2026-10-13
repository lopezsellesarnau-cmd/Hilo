import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type TalkError = 'offline' | 'too_long' | 'other';

/**
 * One turn of the daily talk (Edge Function `talk`): send what the senior said,
 * or nothing to start, and get Hilo's next sentence. The session id ties the turns of one talk together.
 */
export async function sendTurn(
  sessionId: string | null,
  text?: string,
): Promise<{ sessionId: string; reply: string } | { error: TalkError }> {
  const { data, error } = await supabase.functions.invoke('talk', {
    body: { session_id: sessionId ?? undefined, text },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => ({}));
      return { error: body.error === 'too_long' ? 'too_long' : 'other' };
    }
    return { error: 'offline' };
  }
  return { sessionId: data.session_id, reply: data.reply };
}
