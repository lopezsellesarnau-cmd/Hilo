import { useSyncExternalStore } from 'react';

import type { BotShape } from '@/components/live-bot';
import { supabase } from '@/lib/supabase';

/**
 * The shape of her Hilo (people.bot_shape), chosen on her phone's first screen.
 * One value for the whole app: every Bot without an explicit shape follows it.
 */

let shape: BotShape = 'hexagon';
const listeners = new Set<() => void>();

export const getHiloShape = () => shape;
export function setHiloShape(s: BotShape) {
  if (s === shape) return;
  shape = s;
  listeners.forEach((l) => l());
}
export function useHiloShape() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getHiloShape,
    getHiloShape,
  );
}

/** Loads it once signed in: hers on her phone, the senior's on the family's (RLS shows only their family) */
export async function loadHiloShape() {
  const { data } = await supabase.from('people').select('bot_shape').eq('role', 'senior').limit(1).maybeSingle();
  if (data?.bot_shape) setHiloShape(data.bot_shape as BotShape);
}

/** She chose it on her phone */
export async function saveMyHiloShape(s: BotShape) {
  const { error } = await supabase.rpc('set_my_bot_shape', { shape: s });
  if (!error) setHiloShape(s);
  return !error;
}

/** A family member changed it in Ajustes */
export async function saveHiloShape(seniorId: string, s: BotShape) {
  const { error } = await supabase.from('people').update({ bot_shape: s }).eq('id', seniorId);
  if (!error) setHiloShape(s);
  return !error;
}
