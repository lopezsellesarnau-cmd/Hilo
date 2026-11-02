/** Marks a "Recuérdamelo en un rato" reminder: setting the schedule again must not cancel it */
export const SNOOZE = 'snooze';

type Scheduled = { identifier: string; content: { data?: Record<string, unknown> | null } };

/** The reminders to cancel when the schedule is set again: all but the ones she asked for later */
export const toReplace = (scheduled: Scheduled[]) =>
  scheduled.filter((n) => n.content.data?.kind !== SNOOZE).map((n) => n.identifier);
