import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

/**
 * Her last 12 weeks of talks (the StackD Activity grid, Kit 22, flat): one square per day, darker the more
 * she answered Hilo. Drag a finger over it and the days near it lift like under a lens, and the day under
 * the finger shows its date and how many times she answered. Same data as the week strip, further back.
 */

type Props = { seniorId: string; seniorName: string; timezone: string };
type Day = { date: string; answers: number; future: boolean };

const WEEKS = 12;
const GAP = 4;
// 0 answers, then a few, a good talk, a long one
const SHADES = ['#ececec', '#c4c4c4', '#7a7a7a', colors.ink];
const shade = (n: number) => SHADES[n === 0 ? 0 : n <= 3 ? 1 : n <= 8 ? 2 : 3];

/** WEEKS columns of Monday to Sunday, the last one this week; days after today are blank */
function grid(timeZone: string): Day[] {
  const today = localNow(timeZone).date;
  const noon = new Date(`${today}T12:00:00Z`);
  const weekday = (noon.getUTCDay() + 6) % 7; // Monday 0
  const first = new Date(noon.getTime() - (weekday + 7 * (WEEKS - 1)) * 86_400_000);
  return Array.from({ length: WEEKS * 7 }, (_, i) => {
    const date = new Date(first.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date, answers: 0, future: date > today };
  });
}

export function ActivityGrid({ seniorId, seniorName, timezone }: Props) {
  const reduceMotion = useReducedMotion();
  const [days, setDays] = useState<Day[] | null>(null);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  // The finger, in the grid's own coordinates (-1000: not touching)
  const fx = useSharedValue(-1000);
  const fy = useSharedValue(-1000);

  useFocusEffect(
    useCallback(() => {
      const all = grid(timezone);
      supabase
        .from('talk_sessions')
        .select('started_at, answers')
        .eq('person_id', seniorId)
        // A day of margin before the first square: her time zone may be behind UTC
        .gte('started_at', new Date(Date.parse(`${all[0].date}T00:00:00Z`) - 86_400_000).toISOString())
        .then(({ data }) => {
          const byDay = new Map<string, number>();
          for (const k of data ?? []) {
            const d = localNow(timezone, new Date(k.started_at)).date;
            byDay.set(d, (byDay.get(d) ?? 0) + (k.answers ?? 0));
          }
          setDays(all.map((d) => ({ ...d, answers: byDay.get(d.date) ?? 0 })));
        });
    }, [seniorId, timezone]),
  );

  // As wide as the screen allows, but never giant squares (iPad)
  const cell = width ? Math.min(30, (width - GAP * (WEEKS - 1)) / WEEKS) : 0;
  const step = cell + GAP;

  const touch = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    fx.value = reduceMotion ? x : withTiming(x, { duration: 60 });
    fy.value = reduceMotion ? y : withTiming(y, { duration: 60 });
    const col = Math.floor(x / step);
    const row = Math.floor(y / step);
    const i = col * 7 + row;
    setPicked(col >= 0 && col < WEEKS && row >= 0 && row < 7 && days && !days[i]?.future ? i : null);
  };
  const lift = () => {
    fx.value = -1000;
    fy.value = -1000;
    setPicked(null);
  };

  const talked = days?.filter((d) => d.answers > 0).length ?? 0;
  const day = picked !== null && days ? days[picked] : null;
  const line = day
    ? t.today.activityDay(
        new Date(`${day.date}T12:00:00Z`).toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        day.answers,
      )
    : t.today.activitySummary(talked);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t.today.activityTitle(seniorName).toUpperCase()}</Text>
      <Text style={styles.line} accessibilityLiveRegion="polite">
        {days ? line : ' '}
      </Text>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: cell ? step * 7 - GAP : 0 }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={touch}
        onResponderMove={touch}
        onResponderRelease={lift}
        onResponderTerminate={lift}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t.today.activitySummary(talked)}>
        {days && cell
          ? days.map((d, i) => (
              <Square
                key={d.date}
                x={Math.floor(i / 7) * step}
                y={(i % 7) * step}
                size={cell}
                color={d.future ? 'transparent' : shade(d.answers)}
                fx={fx}
                fy={fy}
                on={i === picked}
              />
            ))
          : null}
      </View>
    </View>
  );
}

/** One day: it rises towards the finger like under a lens */
function Square(props: { x: number; y: number; size: number; color: string; fx: SharedValue<number>; fy: SharedValue<number>; on: boolean }) {
  const { x, y, size, color, fx, fy, on } = props;
  const lens = useAnimatedStyle(() => {
    const d = Math.hypot(fx.value - (x + size / 2), fy.value - (y + size / 2));
    const k = Math.max(0, 1 - d / (size * 2.6));
    return { transform: [{ scale: 1 + 0.45 * k * k }], zIndex: Math.round(k * 10) };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.square,
        { left: x, top: y, width: size, height: size, borderRadius: size * 0.28, backgroundColor: color },
        on && styles.squareOn,
        lens,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  // Same as the other section labels on Today
  label: { fontSize: 13, fontWeight: fontWeight.semibold, letterSpacing: 0.8, color: colors.muted },
  line: { fontSize: 16, fontWeight: fontWeight.semibold, color: colors.ink },
  square: { position: 'absolute' },
  squareOn: { borderWidth: 2, borderColor: colors.background },
});
