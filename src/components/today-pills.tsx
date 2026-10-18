import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayDot } from '@/components/day-dot';
import { ListRow } from '@/components/list-row';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { buildDoses, localNow, showTime, type Dose } from '@/lib/time';
import { colors, family, fontWeight } from '@/theme';

type Props = { seniorId: string; seniorName: string; timezone: string };

const MOMENTS = [
  { label: t.todayPills.morning, until: '12:00' },
  { label: t.todayPills.midday, until: '17:00' },
  { label: t.todayPills.afternoon, until: '20:00' },
  { label: t.todayPills.night, until: '24:00' },
];

/** Hoy: today's pills for the family, grouped by moment of the day (design V1). */
export function TodayPills({ seniorId, seniorName, timezone }: Props) {
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [error, setError] = useState(false);
  const now = localNow(timezone);

  useFocusEffect(
    useCallback(() => {
      const today = localNow(timezone);
      (async () => {
        const { data: meds, error: e1 } = await supabase
          .from('medications')
          .select('id, name, times, weekdays')
          .eq('person_id', seniorId)
          .eq('active', true);
        if (e1 || !meds) return setError(true);

        const ids = meds.map((m) => m.id);
        const { data: events, error: e2 } = ids.length
          ? await supabase
              .from('medication_events')
              .select('id, medication_id, scheduled_time, status, confirmed_at')
              .in('medication_id', ids)
              .eq('scheduled_date', today.date)
          : { data: [], error: null };
        if (e2 || !events) return setError(true);

        const list = buildDoses(meds, events, timezone, today.weekday);
        setError(false);
        setDoses(list);
      })();
    }, [seniorId, timezone]),
  );

  if (error) return <Text style={styles.error}>{t.todayPills.loadFailed}</Text>;
  if (!doses) return null;

  const add = () => router.push({ pathname: '/onboarding/pills', params: { seniorId, seniorName, from: 'today' } });

  if (doses.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.heading}>{t.todayPills.title}</Text>
        <ListRow title={t.todayPills.add} detail={t.todayPills.none} onPress={add} />
      </View>
    );
  }

  const taken = doses.filter((d) => d.takenAt).length;

  return (
    <View style={styles.wrap}>
      {/* Like the top row of her Pills screen: the title and how many she has taken */}
      <View style={styles.headRow} accessible accessibilityLabel={t.todayPills.summary(taken, doses.length)}>
        <Text style={styles.heading}>{t.todayPills.title}</Text>
        <Text style={styles.count}>{t.pills.countToday(taken, doses.length)}</Text>
      </View>

      {MOMENTS.map((moment, i) => {
        const from = i === 0 ? '00:00' : MOMENTS[i - 1].until;
        const inMoment = doses.filter((d) => d.time >= from && d.time < moment.until);
        if (inMoment.length === 0) return null;
        return (
          <View key={moment.label} style={styles.moment}>
            <Text style={styles.momentLabel}>{moment.label}</Text>
            {inMoment.map((d) => {
              const late = !d.takenAt && d.time <= now.time;
              return (
                <ListRow
                  key={d.key}
                  // The same dots she sees: done, the one waiting now, later
                  left={<DayDot state={d.takenAt ? 'done' : late ? 'now' : 'later'} />}
                  title={d.name}
                  detail={
                    d.takenAt
                      ? t.todayPills.takenAt(showTime(d.takenAt))
                      : late
                        ? t.todayPills.missed(showTime(d.time))
                        : t.todayPills.at(showTime(d.time))
                  }
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  count: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.muted,
  },
  moment: {
    gap: 10,
  },
  momentLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
  },
});
