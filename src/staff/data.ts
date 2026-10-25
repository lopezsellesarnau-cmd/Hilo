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

type Loaded<T> = { data: T | null; error: boolean; reload: () => void };

/** Everyone in the signed-in staff member's organisation: seniors and their family members. */
export function useStaffPeople(): Loaded<StaffPerson[]> {
  const [data, setData] = useState<StaffPerson[] | null>(null);
  const [error, setError] = useState(false);
  // "Try again" bumps this, which runs the effect again
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    supabase.rpc('staff_people').then(({ data: rows, error: e }) => {
      if (!live) return;
      setError(!!e);
      if (!e) setData((rows ?? []) as StaffPerson[]);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, reload };
}
