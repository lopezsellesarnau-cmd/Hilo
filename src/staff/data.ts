import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/** One row of staff_people(): only the safe columns (see the organizations migration). */
export type StaffPerson = {
  id: string;
  family_id: string;
  role: 'senior' | 'member';
  display_name: string;
  timezone: string;
  locale: string;
  paired: boolean;
  created_at: string;
};

/** One row of staff_signals(): one alert for one person (rules in the staff_signals migration). */
export type StaffSignal = {
  person_id: string;
  kind: 'no_talk' | 'pills' | 'no_family';
  /** no_talk / no_family: days; pills: doses not confirmed yesterday */
  value: number;
  /** pills: doses due yesterday */
  total: number | null;
  /** no_talk / no_family: the last talk or call (null if there never was one) */
  since: string | null;
};

type Loaded<T> = { data: T | null; error: boolean; reload: () => void };

/** Calls a staff function (security definer, RLS-safe) and keeps its rows; "Try again" calls it again. */
function useStaffRpc<T>(fn: 'staff_people' | 'staff_signals'): Loaded<T[]> {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState(false);
  // "Try again" bumps this, which runs the effect again
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    supabase.rpc(fn).then(({ data: rows, error: e }) => {
      if (!live) return;
      setError(!!e);
      if (!e) setData((rows ?? []) as T[]);
    });
    return () => {
      live = false;
    };
  }, [fn, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, reload };
}

/** Everyone in the signed-in staff member's organisation: seniors and their family members. */
export const useStaffPeople = () => useStaffRpc<StaffPerson>('staff_people');

/** Today's alerts for the organisation's seniors. */
export const useStaffSignals = () => useStaffRpc<StaffSignal>('staff_signals');

/** The words on an alert chip. */
export function signalText(s: StaffSignal): string {
  if (s.kind === 'no_talk') return `No talk · ${s.value} days`;
  if (s.kind === 'no_family') return `No family call · ${s.value} days`;
  return s.total && s.total > 1 ? `${s.value} of ${s.total} pills not confirmed` : 'Pill not confirmed';
}

/** A "Done" from Today, with the name of the staff member who did it. */
export type StaffAction = {
  id: string;
  person_id: string;
  user_id: string | null;
  note: string | null;
  created_at: string;
  by: string;
};

/** Today's "Done" actions in the organisation (since local midnight), newest first. */
export function useStaffActionsToday(): Loaded<StaffAction[]> {
  const [data, setData] = useState<StaffAction[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    Promise.all([
      supabase
        .from('staff_actions')
        .select('id, person_id, user_id, note, created_at')
        .gte('created_at', midnight.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('org_members').select('user_id, display_name'),
    ]).then(([actions, team]) => {
      if (!live) return;
      const e = actions.error || team.error;
      setError(!!e);
      if (e) return;
      const names = new Map((team.data ?? []).map((m) => [m.user_id, m.display_name as string]));
      setData(
        (actions.data ?? []).map((a) => ({ ...a, by: (a.user_id && names.get(a.user_id)) || 'Someone' })),
      );
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, reload };
}

export async function markDone(personId: string, note: string): Promise<boolean> {
  const { error } = await supabase.rpc('staff_mark_done', { person: personId, note });
  return !error;
}

export async function undoDone(actionId: string): Promise<boolean> {
  const { error } = await supabase.rpc('staff_undo', { action: actionId });
  return !error;
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
