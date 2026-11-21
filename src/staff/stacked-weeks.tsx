import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';

import { staffColors, staffFont } from './theme';

/**
 * Engagement per week as stacked bars (the StackD Stacked bars, Kit 26): one column per week, as tall as
 * the people with a paired phone, a black capsule for those who talked 4+ days and a grey one for the rest.
 * Run along it and the week under the mouse opens up (its capsules spread apart and widen) while the
 * others step back. No tooltip: the big number counts to that week, the date shows under it and the key
 * gives the split. The bars grow in a wave when it loads. Respects reduced motion.
 */

export type Week = { monday: string; people: number; engaged: number; partial: boolean };

const CHART = 220;
const W = 34; // a capsule's width
const GREY = '#d6d6d3';

const grow: CSSAnimationKeyframes = {
  from: { transform: [{ scaleY: 0 }] },
  to: { transform: [{ scaleY: 1 }] },
};

const pct = (w: Week) => (w.people ? Math.round((100 * w.engaged) / w.people) : 0);

/** A number that counts to its new value instead of jumping */
function useCount(target: number, still: boolean) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (still) {
      from.current = target;
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const a = from.current;
    let id = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 420);
      const v = Math.round(a + (target - a) * (1 - (1 - k) ** 3));
      setShown(v);
      from.current = v;
      if (k < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, still]);
  return shown;
}

export function StackedWeeks({ weeks, goal, label }: { weeks: Week[]; goal: number; label: (w: Week) => string }) {
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const on = hover ?? weeks.length - 1;
  const week = weeks[on];
  const top = Math.max(1, ...weeks.map((w) => w.people));
  const shown = useCount(pct(week), reduceMotion);

  return (
    <View style={styles.wrap}>
      {/* The card reads itself: the number, its week and the split for the week you're on */}
      <View style={styles.read}>
        <View>
          <Text style={styles.big}>{`${shown} %`}</Text>
          <Text style={styles.when}>{`${label(week)} · goal ${goal} %`}</Text>
        </View>
        <View style={styles.key}>
          <Key color={staffColors.ink} text="Talked 4+ days" value={week.engaged} />
          <Key color={GREY} text="Less" value={week.people - week.engaged} />
        </View>
      </View>

      <Pressable onHoverOut={() => setHover(null)} style={styles.chart} accessibilityRole="image" accessibilityLabel={`${weeks.length} weeks of engagement`}>
        {weeks.map((w, i) => {
          const active = i === on;
          const engagedH = (CHART * w.engaged) / top;
          const restH = (CHART * (w.people - w.engaged)) / top;
          return (
            <Pressable
              key={w.monday}
              onHoverIn={() => setHover(i)}
              onPress={() => setHover(i)}
              accessibilityRole="button"
              accessibilityLabel={`${label(w)}: ${w.engaged} of ${w.people} talked 4+ days`}
              style={styles.col}>
              <Animated.View
                style={[
                  styles.stack,
                  { opacity: hover === null || active ? 1 : 0.3, gap: active ? 7 : 3 },
                  !reduceMotion && {
                    animationName: grow,
                    animationDuration: '600ms',
                    animationDelay: `${i * 45}ms`,
                    animationFillMode: 'backwards',
                    animationTimingFunction: 'ease-out',
                  },
                ]}>
                {w.people - w.engaged > 0 ? (
                  <Animated.View style={[styles.capsule, { height: Math.max(W * (active ? 1.25 : 1), restH), width: active ? W + 8 : W, backgroundColor: GREY }]} />
                ) : null}
                {w.engaged > 0 ? (
                  <Animated.View style={[styles.capsule, { height: Math.max(W * (active ? 1.25 : 1), engagedH), width: active ? W + 8 : W, backgroundColor: staffColors.ink }]} />
                ) : null}
              </Animated.View>
              <Text style={[styles.label, active && styles.labelOn]} numberOfLines={2}>
                {label(w)}
              </Text>
            </Pressable>
          );
        })}
      </Pressable>
    </View>
  );
}

function Key({ color, text, value }: { color: string; text: string; value: number }) {
  return (
    <View style={styles.keyRow}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.keyText}>{text}</Text>
      <Text style={styles.keyValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  read: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 },
  big: { fontFamily: staffFont, fontSize: 44, fontWeight: '500', letterSpacing: -1.2, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  when: { fontFamily: staffFont, fontSize: 13, color: staffColors.muted, marginTop: 2 },
  key: { gap: 6, minWidth: 180 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  keyText: { flex: 1, fontFamily: staffFont, fontSize: 14, color: staffColors.soft },
  keyValue: { fontFamily: staffFont, fontSize: 14, fontWeight: '600', color: staffColors.ink, fontVariant: ['tabular-nums'] },
  chart: { height: CHART + 60, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0, height: '100%' },
  stack: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    transformOrigin: 'bottom',
    transitionProperty: ['opacity', 'gap'],
    transitionDuration: '220ms',
  },
  capsule: { borderRadius: 99, transitionProperty: ['width', 'height'], transitionDuration: '220ms' },
  label: { fontFamily: staffFont, fontSize: 12, color: staffColors.muted, textAlign: 'center', minHeight: 30 },
  labelOn: { color: staffColors.ink, fontWeight: '600' },
});
