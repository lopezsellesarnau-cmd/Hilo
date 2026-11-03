import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

type Props = { seniorId: string; timezone: string };
type Day = { date: string; number: string; label: string; talked: boolean; today: boolean };

const DAYS = 7;

/** The last 7 days in her time zone, oldest first */
function lastDays(timeZone: string) {
  return Array.from({ length: DAYS }, (_, i) => {
    const at = new Date(Date.now() - (DAYS - 1 - i) * 86_400_000);
    const local = localNow(timeZone, at);
    return {
      ...local,
      number: String(Number(local.date.slice(8))),
      label: at.toLocaleDateString(dateLocale, { timeZone, weekday: 'short' }).replace('.', '').toUpperCase(),
    };
  });
}

/**
 * Hoy: her week like a calendar strip. A dot under each day she talked (she answered Hilo);
 * today has a ring around it and an orange dot.
 */
export function WeekStrip({ seniorId, timezone }: Props) {
  const [days, setDays] = useState<Day[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      const week = lastDays(timezone);
      const today = week[DAYS - 1].date;
      supabase
        .from('talk_sessions')
        .select('started_at, answers')
        .eq('person_id', seniorId)
        .gte('started_at', new Date(Date.now() - (DAYS + 1) * 86_400_000).toISOString())
        .then(({ data: talks }) => {
          // Days where she really talked: she answered Hilo at least once
          const talked = new Set(
            (talks ?? []).filter((k) => k.answers > 0).map((k) => localNow(timezone, new Date(k.started_at)).date),
          );
          setDays(
            week.map((d) => ({
              date: d.date,
              number: d.number,
              label: d.label,
              talked: talked.has(d.date),
              today: d.date === today,
            })),
          );
        });
    }, [seniorId, timezone]),
  );

  if (!days) return null;
  const summary = t.week.a11y(days.filter((d) => d.talked).length, DAYS);

  return (
    <View style={styles.box} accessible accessibilityLabel={summary}>
      <View style={styles.row}>
        {days.map((d) => (
          <View key={d.date} style={[styles.day, d.today && styles.today]}>
            <Text style={styles.number}>{d.number}</Text>
            <Text style={[styles.label, d.today && styles.labelToday]}>{d.label}</Text>
            <View style={[styles.dot, d.talked && (d.today ? styles.dotToday : styles.dotDone)]} />
          </View>
        ))}
      </View>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: {
    borderColor: colors.ink,
    backgroundColor: colors.background,
  },
  number: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  label: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.muted,
  },
  labelToday: {
    color: colors.nudge,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotDone: {
    backgroundColor: colors.ink,
  },
  dotToday: {
    backgroundColor: colors.nudge,
  },
  summary: {
    paddingHorizontal: 4,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: '#555555',
  },
});
