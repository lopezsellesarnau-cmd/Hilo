import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, Text as SvgText } from 'react-native-svg';

import { LiveBot } from '@/components/live-bot';
import { colors, fontWeight } from '@/theme';

/**
 * The StackD Tape measure (kit/src/components/TapeMeasure.tsx), ported to React Native for her weight.
 * Same pieces: an ink case with a round window onto the coil (it thins and turns as the tape runs out),
 * her Bot as the hub, the tape sliding out of the case's mouth with its marks, the metal hook,
 * the reading at the mouth, and the stiff spring that whips a little.
 * Always locked here: it stays where you leave it (no lock tab).
 */

type Props = {
  value: number;
  onChange: (kg: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Read by VoiceOver */
  label: string;
};

const CASE = 112; // the case, a rounded square
const TAPE_H = 34; // the tape's height
const MOUTH = CASE - 2; // where the tape leaves the case
const WINDOW = 43; // the round window on the case
const COIL = 40; // the coil's radius when all the tape is in
const HUB = 19; // the hub at its centre: the Bot
const TOP = 46; // room for the reading above
const TAPE = '#E2DFD8'; // neutral, no ochre in Hilo v2
const INK = colors.ink;

export function WeightTape({ value, onChange, min = 45, max = 90, step = 0.1, label }: Props) {
  const [width, setWidth] = useState(0);
  const reach = Math.max(40, width - MOUTH - 26); // how far the tape can run out
  const per = reach / (max - min); // pt per kilo
  const reduce = useReducedMotion();
  const [L, setL] = useState(0); // tape out of the case, pt

  const snap = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));

  // Physics, like the web one: the tape chases a target with a stiff spring that overshoots a little
  const st = useRef({ L: 0, v: 0, target: 0, dragging: false, raf: 0, prev: 0, startL: 0, sent: value, kilo: Math.floor(value), placed: false });
  const env = useRef({ per, reach, min, max, step, onChange, reduce });
  useEffect(() => {
    env.current = { per, reach, min, max, step, onChange, reduce };
  });

  // Where the tape sits for a value from outside (first layout, a saved weight loaded)
  useEffect(() => {
    if (!width) return;
    const s = st.current;
    if (s.dragging || (s.placed && Math.abs(value - s.sent) < step / 2)) return;
    s.placed = true;
    s.L = s.target = (Math.min(max, Math.max(min, value)) - min) * per;
    s.sent = value;
    setL(s.L);
  }, [value, width, per, min, max, step]);

  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  // The refs are read only inside the loop and the gesture handlers, never while rendering
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const run = () => {
      const s = st.current;
      if (s.raf) return;
      const tick = (now: number) => {
        const e = env.current;
        const dt = s.prev ? Math.min(2.5, (now - s.prev) / 16.67) : 1;
        s.prev = now;
        if (e.reduce) {
          s.L = s.target;
          s.v = 0;
        } else {
          s.v = (s.v + (s.target - s.L) * 0.075 * dt) * Math.pow(0.8, dt);
          s.L += s.v * dt;
          if (s.L < 0) {
            s.L = 0;
            s.v = 0;
          }
        }
        setL(s.L);
        const k = Math.round((Math.round(Math.min(e.max, Math.max(e.min, e.min + s.L / e.per)) / e.step) * e.step) * 10) / 10;
        if (k !== s.sent) {
          s.sent = k;
          e.onChange(k);
          if (Math.floor(k) !== s.kilo) {
            s.kilo = Math.floor(k);
            Haptics.selectionAsync().catch(() => {});
          }
        }
        if (Math.abs(s.target - s.L) + Math.abs(s.v) < 0.1 && !s.dragging) {
          s.L = s.target;
          setL(s.L);
          s.raf = 0;
          s.prev = 0;
          return;
        }
        s.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const s = st.current;
        s.dragging = true;
        s.startL = s.L;
      },
      onPanResponderMove: (_, g) => {
        const s = st.current;
        s.target = Math.min(env.current.reach, Math.max(0, s.startL + g.dx));
        run();
      },
      onPanResponderRelease: () => {
        const s = st.current;
        const e = env.current;
        s.dragging = false;
        // always locked: it stays, snapped to the step
        const v = Math.round(Math.min(e.max, Math.max(e.min, e.min + s.target / e.per)) / e.step) * e.step;
        s.target = (v - e.min) * e.per;
        run();
      },
    });
  });

  const onAction = (e: AccessibilityActionEvent) => {
    const v = snap(value + (e.nativeEvent.actionName === 'increment' ? step : -step));
    const s = st.current;
    s.L = s.target = (v - min) * per;
    s.sent = Math.round(v * 10) / 10;
    setL(s.L);
    onChange(s.sent);
  };

  // The marks: a tick every kilo, numbers every 10, from the hook back towards the case
  const marks = [];
  if (width) {
    const pick = (opts: number[], gap: number) => opts.find((u) => u * per >= gap) ?? opts[opts.length - 1];
    const minor = pick([1, 2, 5, 10], 4);
    const numbered = pick([10, 20, 50], 34);
    for (let v = min; v <= max + 1e-9; v += minor) {
      const x = reach - (v - min) * per;
      const n = Math.round(v - min);
      const big = n % numbered === 0;
      const tall = big ? 16 : n % (minor * 5) === 0 ? 11 : 6;
      marks.push(<Line key={v} x1={x} x2={x} y1={TAPE_H - 2} y2={TAPE_H - 2 - tall} stroke={INK} strokeWidth={big ? 1.6 : 1} />);
      if (big && v !== min) {
        marks.push(
          <SvgText key={`t${v}`} x={x - 3} y={13} textAnchor="end" fontSize={11} fontWeight="600" fill={INK}>
            {String(v)}
          </SvgText>,
        );
      }
    }
  }

  // The coil thins as the tape runs out, and turns with it
  const R = HUB + 3 + (COIL - HUB - 3) * (1 - Math.min(1, L / reach));
  const turn = (-L / ((R + HUB) / 2)) * (180 / Math.PI);
  const c = CASE / 2;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={styles.wrap}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value.toFixed(1)} kg` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}>
      {/* The reading at the case's mouth */}
      <View pointerEvents="none" style={[styles.reading, { left: MOUTH }]}>
        <Text style={styles.readingText}>{value.toFixed(1).replace('.', ',')} kg</Text>
      </View>

      {width ? (
        <>
          {/* The tape, clipped at the case's mouth, sliding out */}
          <View pointerEvents="none" style={[styles.clip, { left: MOUTH, width: reach + 4 }]}>
            <View style={[styles.strip, { width: reach, transform: [{ translateX: L - reach }] }]}>
              <Svg width={reach} height={TAPE_H}>
                {marks}
              </Svg>
            </View>
          </View>
          {/* Its hook */}
          <View pointerEvents="none" style={[styles.hook, { transform: [{ translateX: L }] }]} />
        </>
      ) : null}

      {/* The case: a window onto the coil, the Bot as its hub */}
      <View pointerEvents="none" style={styles.case}>
        <Svg width={CASE} height={CASE} style={StyleSheet.absoluteFill}>
          <Defs>
            <ClipPath id="coil">
              <Circle cx={c} cy={c} r={R} />
            </ClipPath>
          </Defs>
          <Circle cx={c} cy={c} r={WINDOW} fill="rgba(255,255,255,0.08)" />
          <Circle cx={c} cy={c} r={R} fill={TAPE} />
          <G clipPath="url(#coil)">
            {Array.from({ length: Math.floor((COIL - HUB) / 2.4) }, (_, k) => (
              <Circle key={k} cx={c} cy={c} r={HUB + 2 + k * 2.4} fill="none" stroke="rgba(20,19,16,0.28)" strokeWidth={0.8} />
            ))}
            <G rotation={turn} origin={`${c}, ${c}`}>
              {Array.from({ length: 6 }, (_, k) => {
                const a = (k / 6) * Math.PI * 2;
                return (
                  <Line
                    key={k}
                    x1={c + Math.cos(a) * (HUB + 6)}
                    y1={c + Math.sin(a) * (HUB + 6)}
                    x2={c + Math.cos(a) * (COIL - 1)}
                    y2={c + Math.sin(a) * (COIL - 1)}
                    stroke="rgba(20,19,16,0.35)"
                    strokeWidth={1.2}
                  />
                );
              })}
            </G>
          </G>
          <Circle cx={c} cy={c} r={HUB} fill={INK} />
        </Svg>
        <View style={styles.hub}>
          <LiveBot size={HUB * 2 - 6} color={colors.background} eyeColor={INK} look="right" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: TOP + CASE + 12 },
  reading: { position: 'absolute', top: 0, height: 30, paddingHorizontal: 11, borderRadius: 15, justifyContent: 'center', backgroundColor: INK, transform: [{ translateX: '-50%' }] },
  readingText: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.onAccent, fontVariant: ['tabular-nums'] },
  clip: { position: 'absolute', top: TOP + CASE / 2 - TAPE_H / 2 + 8, height: TAPE_H, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0, left: 0, height: TAPE_H, borderRadius: 3, backgroundColor: TAPE, borderBottomWidth: 2, borderBottomColor: 'rgba(0,0,0,0.12)' },
  hook: { position: 'absolute', left: MOUTH + 2, top: TOP + CASE / 2 - TAPE_H / 2 + 2, width: 12, height: TAPE_H + 12, zIndex: 2, backgroundColor: '#8E8A80', borderTopLeftRadius: 2, borderBottomLeftRadius: 2, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  case: { position: 'absolute', left: 0, top: TOP, width: CASE, height: CASE, borderRadius: 30, backgroundColor: INK },
  hub: { position: 'absolute', left: 0, top: 0, width: CASE, height: CASE, alignItems: 'center', justifyContent: 'center' },
});
