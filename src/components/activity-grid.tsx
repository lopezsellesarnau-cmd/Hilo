import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

/**
 * Her last 12 weeks of talks (the StackD Activity grid, Kit 22, flat): one square per day, darker the more
 * she answered Hilo. Drag a finger over it (or move the mouse, on the web) and the days near it lift like
 * under a lens, and the day under it shows its date and how many times she answered.
 * `ActivityGrid` only draws; the family's version loads her talks itself, the staff page passes its own.
 */

type Day = { date: string; answers: number; future: boolean };
type Props = {
  timezone: string;
  /** How many times she answered, by local day (YYYY-MM-DD). null while loading. */
  answers: Record<string, number> | null;
  title: string;
  summary: (days: number) => string;
  dayLine: (date: string, answers: number) => string;
  /** For the date under the finger */
  locale: string;
  fontFamily?: string;
};

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

/** The family's grid: loads her talks with the family's own access, like the week strip */
export function FamilyActivityGrid({ seniorId, seniorName, timezone }: { seniorId: string; seniorName: string; timezone: string }) {
  const [answers, setAnswers] = useState<Record<string, number> | null>(null);
  useFocusEffect(
    useCallback(() => {
      const first = grid(timezone)[0].date;
      supabase
        .from('talk_sessions')
        .select('started_at, answers')
        .eq('person_id', seniorId)
        // A day of margin before the first square: her time zone may be behind UTC
        .gte('started_at', new Date(Date.parse(`${first}T00:00:00Z`) - 86_400_000).toISOString())
        .then(({ data }) => {
          const byDay: Record<string, number> = {};
          for (const k of data ?? []) {
            const d = localNow(timezone, new Date(k.started_at)).date;
            byDay[d] = (byDay[d] ?? 0) + (k.answers ?? 0);
          }
          setAnswers(byDay);
        });
    }, [seniorId, timezone]),
  );
  return (
    <ActivityGrid
      timezone={timezone}
      answers={answers}
      title={t.today.activityTitle(seniorName).toUpperCase()}
      summary={t.today.activitySummary}
      dayLine={t.today.activityDay}
      locale={dateLocale}
    />
  );
}

export function ActivityGrid({ timezone, answers, title, summary, dayLine, locale, fontFamily }: Props) {
  const reduceMotion = useReducedMotion();
  const days = useMemo(() => (answers ? grid(timezone).map((d) => ({ ...d, answers: answers[d.date] ?? 0 })) : null), [answers, timezone]);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  // The finger, in the grid's own coordinates (-1000: not touching)
  const fx = useSharedValue(-1000);
  const fy = useSharedValue(-1000);

  // As wide as the screen allows, but never giant squares (iPad)
  const cell = width ? Math.min(30, (width - GAP * (WEEKS - 1)) / WEEKS) : 0;
  const step = cell + GAP;

  const point = (x: number, y: number) => {
    fx.value = reduceMotion ? x : withTiming(x, { duration: 60 });
    fy.value = reduceMotion ? y : withTiming(y, { duration: 60 });
    const col = Math.floor(x / step);
    const row = Math.floor(y / step);
    const i = col * 7 + row;
    setPicked(col >= 0 && col < WEEKS && row >= 0 && row < 7 && days && !days[i]?.future ? i : null);
  };
  const touch = (e: GestureResponderEvent) => point(e.nativeEvent.locationX, e.nativeEvent.locationY);

  const lift = () => {
    fx.value = -1000;
    fy.value = -1000;
    setPicked(null);
  };

  // The web: the lens follows the mouse too, without pressing (react-native-web's View has no pointer move)
  const area = useRef<View>(null);
  const follow = useRef({ point, lift });
  useEffect(() => {
    follow.current = { point, lift };
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = area.current as unknown as HTMLElement | null;
    if (!el?.addEventListener) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      follow.current.point(e.clientX - r.left, e.clientY - r.top);
    };
    const leave = () => follow.current.lift();
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  }, [days]);

  const talked = days?.filter((d) => d.answers > 0).length ?? 0;
  const day = picked !== null && days ? days[picked] : null;
  const line = day
    ? dayLine(
        new Date(`${day.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        day.answers,
      )
    : summary(talked);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, fontFamily ? { fontFamily } : null]}>{title}</Text>
      <Text style={[styles.line, fontFamily ? { fontFamily } : null]} accessibilityLiveRegion="polite">
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
        ref={area}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary(talked)}>
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
