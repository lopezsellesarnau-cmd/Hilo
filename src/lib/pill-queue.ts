import type { Dose } from './time';

export type DayPill = Dose & { snoozedUntil?: string };

/** How long "Hecho" and "Deshacer" stay after marking, in case of a wrong tap */
export const DONE_MS = 10_000;
/** Shorter when another pill is already due: she goes on to it without going back home */
export const NEXT_MS = 3_000;

/** The pill to take now: its time has passed, not taken yet and not put off for later */
export const dueNow = (pills: DayPill[], now: string) =>
  pills.find((p) => !p.takenAt && p.time <= now && !(p.snoozedUntil && p.snoozedUntil > now));

/** How long "Hecho" stays after she marks `key` as taken */
export const doneFor = (pills: DayPill[], key: string, now: string) =>
  dueNow(pills.filter((p) => p.key !== key), now) ? NEXT_MS : DONE_MS;
