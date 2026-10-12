import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { supabase } from '@/lib/supabase';
import { buildDoses, localNow, showTime, type Dose } from '@/lib/time';
import { colors, family, fontWeight } from '@/theme';

const pillIcon = require('../../assets/icons/pill-small.svg');

type Props = { seniorId: string; seniorName: string; timezone: string };

const MOMENTS = [
  { label: 'POR LA MAÑANA', until: '12:00' },
  { label: 'A MEDIODÍA', until: '17:00' },
  { label: 'POR LA TARDE', until: '20:00' },
  { label: 'POR LA NOCHE', until: '24:00' },
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

  if (error) return <Text style={styles.error}>No hemos podido cargar las pastillas. Comprueba tu conexión.</Text>;
  if (!doses) return null;

  if (doses.length === 0) {
    return (
      <View style={[styles.card, styles.cardTodo]}>
        <View style={styles.cardText}>
          <Text style={styles.name}>Pastillas</Text>
          <Text style={styles.detail}>Hoy no tiene ninguna. Si toma alguna, añádela y Hilo se la recordará.</Text>
        </View>
        <BigButton
          scale="family"
          variant="outline"
          label="Añadir pastillas"
          onPress={() => router.push({ pathname: '/onboarding/pills', params: { seniorId, seniorName, from: 'today' } })}
        />
      </View>
    );
  }

  const taken = doses.filter((d) => d.takenAt).length;

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Pastillas: {taken} de {doses.length} tomadas
        </Text>
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {doses.map((d) => (
            <View key={d.key} style={[styles.bar, d.takenAt && styles.barOn]} />
          ))}
        </View>
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
                <View key={d.key} style={[styles.card, late && styles.cardTodo, !d.takenAt && !late && styles.cardLater]}>
                  {d.takenAt ? (
                    <View style={styles.tick}>
                      <Text style={styles.tickText}>✓</Text>
                    </View>
                  ) : (
                    <Image source={pillIcon} style={[styles.icon, !late && styles.iconLater]} contentFit="contain" />
                  )}
                  <View style={styles.cardText}>
                    <Text style={styles.name}>{d.name}</Text>
                    <Text style={[styles.detail, !d.takenAt && !late && styles.muted]}>
                      {d.takenAt
                        ? `Tomada a las ${showTime(d.takenAt)}.`
                        : late
                          ? `Era a las ${showTime(d.time)}. Aún no la ha marcado.`
                          : `A las ${showTime(d.time)}.`}
                    </Text>
                  </View>
                </View>
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
    gap: 18,
    marginTop: 8,
  },
  summary: {
    gap: 8,
  },
  summaryText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  bars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  bar: {
    width: 30,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(143, 168, 138, 0.3)',
  },
  barOn: {
    backgroundColor: colors.sage,
  },
  moment: {
    gap: 10,
  },
  momentLabel: {
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#f2f5f1',
  },
  cardTodo: {
    backgroundColor: colors.background,
    borderWidth: 3,
    borderColor: colors.sage,
  },
  cardLater: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: '#ececea',
  },
  cardText: {
    flex: 1,
    minWidth: 200,
    gap: 2,
  },
  tick: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickText: {
    fontSize: 18,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  icon: {
    flexShrink: 0,
    width: 34,
    height: 34,
  },
  iconLater: {
    opacity: 0.35,
  },
  name: {
    fontSize: 20,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  detail: {
    fontSize: family.fontSize.body,
    lineHeight: 25,
    color: '#555555',
  },
  muted: {
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
  },
});
