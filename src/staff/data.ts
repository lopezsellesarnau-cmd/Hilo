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
