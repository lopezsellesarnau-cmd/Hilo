import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { colors, fontWeight } from '@/theme';

/**
 * Her weight over 1, 3 or 12 months: a thick line, a soft fill under it, the top and bottom
 * values and the last weighing marked. The range tabs are the StackD Elastic tabs (a pill that springs).
 */

export type WeightPoint = { kg: number; at: string };
export type Range = 'm1' | 'm3' | 'y1';
const DAYS: Record<Range, number> = { m1: 31, m3: 92, y1: 366 };

type Props = {
  points: WeightPoint[];
  range: Range;
  onRange: (r: Range) => void;
  labels: Record<Range, string>;
  /** "Today" under the right end */
  today: string;
  empty: string;
};

export function inRange(points: WeightPoint[], range: Range) {
  const from = Date.now() - DAYS[range] * 86_400_000;
  return points.filter((p) => Date.parse(p.at) >= from).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function WeightChart({ points, range, onRange, labels, today, empty }: Props) {
  const [w, setW] = useState(0);
  const h = 130;
  const data = inRange(points, range);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  let chart = null;
  if (w && data.length >= 2) {
    const kgs = data.map((p) => p.kg);
    const lo = Math.floor(Math.min(...kgs) - 0.4);
    const hi = Math.ceil(Math.max(...kgs) + 0.4);
    const t0 = Date.parse(data[0].at);
    const t1 = Math.max(t0 + 1, Date.parse(data[data.length - 1].at));
    const pts = data.map((p) => [8 + ((Date.parse(p.at) - t0) / (t1 - t0)) * (w - 16), 10 + (h - 20) * (1 - (p.kg - lo) / (hi - lo))] as const);
    const line = pts.map(([x, y], i) => (i ? `C${(pts[i - 1][0] + x) / 2} ${pts[i - 1][1]} ${(pts[i - 1][0] + x) / 2} ${y} ${x} ${y}` : `M${x} ${y}`)).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
    const [lx, ly] = pts[pts.length - 1];
    const first = new Date(data[0].at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    chart = (
      <Svg width={w} height={h + 22}>
        <Defs>
          <LinearGradient id="area" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={colors.ink} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.ink} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[hi, lo].map((v, i) => (
          <Line key={`l${v}`} x1={0} x2={w} y1={i ? h : 10} y2={i ? h : 10} stroke={colors.ink} strokeOpacity={0.08} strokeDasharray="2 5" />
        ))}
        {[hi, lo].map((v, i) => (
          <SvgText key={`t${v}`} x={w} y={i ? h - 6 : 24} fontSize={12} fontWeight="600" fill={colors.ink} fillOpacity={0.35} textAnchor="end">
            {String(v)}
          </SvgText>
        ))}
        <Path d={area} fill="url(#area)" />
        <Path d={line} fill="none" stroke={colors.ink} strokeWidth={4.5} strokeLinecap="round" />
        <Circle cx={lx} cy={ly} r={12} fill={colors.ink} fillOpacity={0.12} />
        <Circle cx={lx} cy={ly} r={7} fill={colors.ink} />
        <SvgText x={0} y={h + 18} fontSize={12} fontWeight="600" fill={colors.ink} fillOpacity={0.35}>
          {first}
        </SvgText>
        <SvgText x={w} y={h + 18} fontSize={12} fontWeight="600" fill={colors.ink} fillOpacity={0.35} textAnchor="end">
          {today}
        </SvgText>
      </Svg>
    );
  }

  return (
    <View>
      <Tabs value={range} onChange={onRange} labels={labels} />
      <View style={styles.chart} onLayout={onLayout}>
        {chart ?? <Text style={styles.empty}>{empty}</Text>}
      </View>
    </View>
  );
}

/** Three tabs with one black pill that springs between them */
function Tabs({ value, onChange, labels }: { value: Range; onChange: (r: Range) => void; labels: Record<Range, string> }) {
  const ids = Object.keys(labels) as Range[];
  const [w, setW] = useState(0);
  const reduce = useReducedMotion();
  const cell = (w - 8) / ids.length;
  const i = ids.indexOf(value);
  const pill = useAnimatedStyle(() => ({
    width: cell,
    transform: [{ translateX: reduce ? i * cell : withSpring(i * cell, { damping: 14, stiffness: 180 }) }],
  }));
  return (
    <View style={styles.tabs} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {w ? <Animated.View style={[styles.pill, pill]} /> : null}
      {ids.map((id) => (
        <Pressable key={id} onPress={() => onChange(id)} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: id === value }}>
          <Text style={[styles.tabText, id === value && styles.tabOn]}>{labels[id]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { marginTop: 16, minHeight: 152, justifyContent: 'center' },
  empty: { fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted, textAlign: 'center' },
  tabs: { height: 44, borderRadius: 22, padding: 4, flexDirection: 'row', backgroundColor: colors.surface },
  pill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: 18, backgroundColor: colors.ink },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, fontWeight: fontWeight.bold, color: colors.muted },
  tabOn: { color: colors.onAccent },
});
