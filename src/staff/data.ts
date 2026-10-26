import { useCallback, useEffect, useState } from 'react';

import type { Place } from '@/lib/place';
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
      setData((actions.data ?? []).map((a) => ({ ...a, by: (a.user_id && names.get(a.user_id)) || 'Someone' })));
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

export const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** staff_person_week(): her last 7 days as counts (oldest first), never content. */
export type PersonWeek = {
  days: { day: string; talks: number; due: number; taken: number; calls: number }[];
  last_talk: string | null;
  last_call: string | null;
};

/** One person's week and the team's notes about her (newest first). */
export function usePersonPage(personId: string): Loaded<{ week: PersonWeek; notes: StaffAction[] }> {
  const [data, setData] = useState<{ week: PersonWeek; notes: StaffAction[] } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    Promise.all([
      supabase.rpc('staff_person_week', { person: personId }),
      supabase
        .from('staff_actions')
        .select('id, person_id, user_id, note, created_at')
        .eq('person_id', personId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('org_members').select('user_id, display_name'),
    ]).then(([week, actions, team]) => {
      if (!live) return;
      const e = week.error || actions.error || team.error;
      setError(!!e);
      if (e) return;
      const names = new Map((team.data ?? []).map((m) => [m.user_id, m.display_name as string]));
      setData({
        week: week.data as PersonWeek,
        notes: (actions.data ?? []).map((a) => ({ ...a, by: (a.user_id && names.get(a.user_id)) || 'Someone' })),
      });
    });
    return () => {
      live = false;
    };
  }, [personId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, reload };
}

const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

/** An alert as a headline and the fact behind it, e.g. "No talk for 3 days" / "Last one Wednesday 22 Oct, 10:34". */
export function signalLines(s: StaffSignal): { title: string; detail: string } {
  if (s.kind === 'no_talk') {
    return {
      title: `No talk for ${s.value} days`,
      detail: s.since ? `Last one ${shortDay(s.since)}, ${clock(s.since)}` : 'No talk since she joined',
    };
  }
  if (s.kind === 'no_family') {
    return {
      title: `No family call for ${s.value} days`,
      detail: s.since ? `Last one ${shortDay(s.since)}` : 'No family call yet',
    };
  }
  return {
    title: s.total && s.total > 1 ? `${s.value} of ${s.total} pills not confirmed` : 'Pill not confirmed',
    detail: 'Yesterday',
  };
}

/** A pill as staff type it on New person: a name and its times ("09:00"). */
export type NewPill = { name: string; times: string[] };

export type NewPerson = {
  name: string;
  locale: 'es' | 'en' | 'nl';
  talkTime: string;
  timezone: string;
  /** Hilo's voice speed, 0.7-1.2 */
  voiceSpeed: number;
  /** user_id of her carer in the team, or null */
  carerId: string | null;
  place: Place | null;
  pills: NewPill[];
};

/** Adds her to the organisation (family, subscription and pills in one go). Her person id, or null if it failed. */
export async function createPerson(orgId: string, p: NewPerson): Promise<string | null> {
  const { data, error } = await supabase.rpc('staff_create_person', {
    org: orgId,
    name: p.name,
    locale: p.locale,
    talk_time: p.talkTime,
    timezone: p.timezone,
    voice_speed: p.voiceSpeed,
    carer: p.carerId,
    city: p.place?.city ?? null,
    latitude: p.place?.latitude ?? null,
    longitude: p.place?.longitude ?? null,
    country_code: p.place?.country_code ?? null,
    region_code: p.place?.region_code ?? null,
    pills: p.pills,
  });
  if (error && __DEV__) console.warn('staff_create_person', error);
  return error ? null : (data as string);
}

/** A fresh 15-minute code for her phone (replaces any older one). Null if it failed. */
export async function pairingCode(personId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('staff_pairing_code', { senior: personId });
  return error ? null : (data as string);
}

/** The organisation's team (for "Carer"), by name. */
export function useTeam(): Loaded<{ user_id: string; display_name: string; role: 'admin' | 'carer' }[]> {
  const [data, setData] = useState<{ user_id: string; display_name: string; role: 'admin' | 'carer' }[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    supabase
      .from('org_members')
      .select('user_id, display_name, role')
      .order('display_name')
      .then(({ data: rows, error: e }) => {
        if (!live) return;
        setError(!!e);
        if (!e) setData(rows ?? []);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, reload };
}

/** A sample sentence in Hilo's talk voice (voice-sample function): its words and the mp3 in base64. */
export async function voiceSample(locale: string, speed: number, name: string): Promise<{ text: string; audio: string } | null> {
  const { data, error } = await supabase.functions.invoke('voice-sample', { body: { locale, speed, name } });
  if (error && __DEV__) console.warn('voice-sample', error);
  return error || !data?.audio ? null : (data as { text: string; audio: string });
}
