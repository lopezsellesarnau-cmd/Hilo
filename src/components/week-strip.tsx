import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayDot } from '@/components/day-dot';
import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { buildDoses, localNow } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

type Props = { seniorId: string; timezone: string };
type State = 'done' | 'now' | 'later' | null;
type Day = { date: string; letter: string; talk: State; pills: State };

const DAYS = 7;
const DOT = 26;

/** The last 7 days in her time zone, oldest first */
function lastDays(timeZone: string) {
  return Array.from({ length: DAYS }, (_, i) => {
    const at = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000);
    const local = localNow(timeZone, at);
    return { ...local, letter: at.toLocaleDateString(dateLocale, { timeZone, weekday: 'narrow' }) };
  });
}

/**
 * Hoy: her week at a glance. A dot per day for the talk (she answered Hilo) and for the pills (all taken).
 * Today, if it isn't done yet, is the ring of "now", like on her Pills screen.
 */
export function WeekStrip({ seniorId, timezone }: Props) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [hasPills, setHasPills] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const week = lastDays(timezone);
      const today = week[DAYS - 1].date;
      (async () => {
        const [{ data: talks }, { data: meds }] = await Promise.all([
          supabase
            .from('talk_sessions')
            .select('started_at, turns(count)')
            .eq('person_id', seniorId)
            .gte('started_at', new Date(Date.now() - (DAYS + 1) * 86_400_000).toISOString()),
          supabase.from('medications').select('id, name, times, weekdays').eq('person_id', seniorId).eq('active', true),
        ]);
        const ids = (meds ?? []).map((m) => m.id);
        const { data: events } = ids.length
          ? await supabase
              .from('medication_events')
              .select('id, medication_id, scheduled_date, scheduled_time, status, confirmed_at')
              .in('medication_id', ids)
              .gte('scheduled_date', week[0].date)
          : { data: [] };

        // Days where she really talked: more than Hilo's greeting
        const talked = new Set(
          (talks ?? [])
            .filter((k) => ((k.turns as { count: number }[])[0]?.count ?? 0) > 1)
            .map((k) => localNow(timezone, new Date(k.started_at)).date),
        );
        setHasPills(ids.length > 0);
        setDays(
          week.map((d) => {
            const doses = buildDoses(
              meds ?? [],
              (events ?? []).filter((e) => e.scheduled_date === d.date),
              timezone,
              d.weekday,
            );
            const allTaken = doses.length > 0 && doses.every((x) => x.takenAt);
            return {
              date: d.date,
              letter: d.letter,
              talk: talked.has(d.date) ? 'done' : d.date === today ? 'now' : 'later',
              pills: !doses.length ? null : allTaken ? 'done' : d.date === today ? 'now' : 'later',
            };
          }),
        );
      })();
    }, [seniorId, timezone]),
  );

  if (!days) return null;
  const talks = days.filter((d) => d.talk === 'done').length;

  return (
    <View style={styles.box} accessible accessibilityLabel={t.week.a11y(talks, DAYS)}>
      <View style={styles.row}>
        <Text style={styles.rowLabel} />
        {days.map((d) => (
          <Text key={d.date} style={styles.letter}>
            {d.letter.toUpperCase()}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t.week.talk}</Text>
        {days.map((d) => (
          <View key={d.date} style={styles.cell}>
            <DayDot state={d.talk ?? 'later'} size={DOT} />
          </View>
        ))}
      </View>
      {hasPills ? (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t.week.pills}</Text>
          {days.map((d) => (
            <View key={d.date} style={styles.cell}>
              {d.pills ? <DayDot state={d.pills} size={DOT} /> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 10,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    width: 78,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  letter: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
});
