const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/**
 * Date, time and ISO weekday in a given time zone (the senior's, from people.timezone),
 * so the family side and the senior side agree on "today" wherever the phones are.
 */
export function localNow(timeZone: string, date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    /** 'YYYY-MM-DD' */
    date: `${parts.year}-${parts.month}-${parts.day}`,
    /** 'HH:mm' */
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** '09:15' or '09:15:00' → '9:15' */
export const showTime = (t: string) => t.slice(0, 5).replace(/^0/, '');

export type Dose = {
  key: string;
  medicationId: string;
  name: string;
  /** 'HH:mm', local time of the senior */
  time: string;
  /** 'HH:mm' when it was taken, local time of the senior */
  takenAt: string | null;
  /** The medication_events row, when there is one */
  eventId: string | null;
};

type Medication = { id: string; name: string; times: string[]; weekdays: number[] };
type DoseEvent = { id: string; medication_id: string; scheduled_time: string; status: string; confirmed_at: string | null };

/** Today's doses from the schedule and today's events, sorted by time. */
export function buildDoses(meds: Medication[], events: DoseEvent[], timeZone: string, weekday: number): Dose[] {
  return meds
    .filter((m) => m.weekdays.includes(weekday))
    .flatMap((m) =>
      m.times.map((t) => {
        const time = t.slice(0, 5);
        const event = events.find(
          (ev) => ev.medication_id === m.id && ev.scheduled_time.slice(0, 5) === time && ev.status === 'taken',
        );
        return {
          key: `${m.id}-${time}`,
          medicationId: m.id,
          name: m.name,
          time,
          takenAt: event ? (event.confirmed_at ? localNow(timeZone, new Date(event.confirmed_at)).time : time) : null,
          eventId: event?.id ?? null,
        };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}
