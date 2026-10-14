import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type TalkError = 'offline' | 'too_long' | 'other';

/**
 * One turn of the daily talk (Edge Function `talk`): send what the senior said,
 * or nothing to start, and get Hilo's next sentence with its audio, whether it asks about her pills,
 * and whether Hilo said goodbye (the talk is closed) (mp3 in base64, or null if the voice failed).
 * The session id ties the turns of one talk together.
 */
export async function sendTurn(
  sessionId: string | null,
  text?: string,
  /** Her answer to the pill question, from the Sí / No buttons */
  pills?: 'yes' | 'no',
): Promise<
  { sessionId: string; reply: string; audio: string | null; askPills: boolean; ended: boolean } | { error: TalkError }
> {
  const { data, error } = await supabase.functions.invoke('talk', {
    body: { session_id: sessionId ?? undefined, text, pills },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => ({}));
      return { error: body.error === 'too_long' ? 'too_long' : 'other' };
    }
    return { error: 'offline' };
  }
  return {
    sessionId: data.session_id,
    reply: data.reply,
    audio: data.audio ?? null,
    askPills: Boolean(data.ask_pills),
    ended: Boolean(data.ended),
  };
}

/** She left the talk without a goodbye: the talk is closed and her story still goes to the book */
export function leaveTalk(sessionId: string) {
  supabase.functions.invoke('talk', { body: { session_id: sessionId, leave: true } });
}
