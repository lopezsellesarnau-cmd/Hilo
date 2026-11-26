import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

/**
 * Split-flap display (StackD Kit 06), for React Native. Text on little tiles that flip like an old
 * departure board: when the value changes, each tile runs through the characters to the new one,
 * the top half falling over the bottom, and the columns start one after another.
 * Dark tiles (as on Hoy). Respects Reduce Motion.
 */

export const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789.,:-+/';

type Props = {
  value: string;
  /** Pad to this many tiles */
  length?: number;
  /** Tile height in pt */
  size?: number;
  /** ms per flip */
  speed?: number;
  /** ms between columns */
  stagger?: number;
  /** Read by VoiceOver instead of the letters */
  label?: string;
};

const BG = '#1e1d1a';
const FG = '#f2f2f0';
const LINE = '#0b0a08';

export function SplitFlap({ value, length, size = 44, speed = 70, stagger = 45, label }: Props) {
  let text = Array.from(value.toUpperCase())
    .map((c) => (CHARS.includes(c) ? c : ' '))
    .join('');
  if (length) text = text.padEnd(length, ' ').slice(0, length);
  return (
    <View style={[styles.row, { gap: Math.round(size * 0.08) }]} accessible accessibilityRole="text" accessibilityLabel={label ?? value}>
      {Array.from(text).map((c, i) => (
        <Tile key={i} target={c} size={size} speed={speed} delay={i * stagger} />
      ))}
    </View>
  );
}

function Tile({ target, size, speed, delay }: { target: string; size: number; speed: number; delay: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(' ');
  const [next, setNext] = useState<string | null>(null);
  const now = useRef(' ');
  const fall = useSharedValue(0); // 0 → -90: the old top half falls
  const land = useSharedValue(90); // 90 → 0: the new bottom half lands

  useEffect(() => {
    if (now.current === target) return;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (now.current === target) return setNext(null);
      // one character along, like the real thing (straight there with Reduce Motion)
      const to = reduce ? target : CHARS[(CHARS.indexOf(now.current) + 1) % CHARS.length];
      setNext(to);
      fall.value = 0;
      land.value = 90;
      if (!reduce) {
        fall.value = withTiming(-90, { duration: speed / 2, easing: Easing.in(Easing.quad) });
        land.value = withDelay(speed / 2, withTiming(0, { duration: speed / 2, easing: Easing.out(Easing.quad) }));
      }
      t = setTimeout(
        () => {
          now.current = to;
          setShown(to);
          step();
        },
        reduce ? 0 : speed,
      );
    };
    t = setTimeout(step, reduce ? 0 : delay);
    return () => clearTimeout(t);
  }, [target, speed, delay, reduce, fall, land]);

  const w = Math.round(size * 0.72);
  const r = Math.round(size * 0.1);
  const fallStyle = useAnimatedStyle(() => ({ transform: [{ perspective: size * 5 }, { rotateX: `${fall.value}deg` }] }));
  const landStyle = useAnimatedStyle(() => ({ transform: [{ perspective: size * 5 }, { rotateX: `${land.value}deg` }] }));
  const half = { height: size / 2, borderRadius: r };

  return (
    <View style={[styles.tile, { width: w, height: size, borderRadius: r }]}>
      {/* top: the new character waits behind the falling flap */}
      <View style={[styles.half, styles.top, half]}>
        <Glyph c={next ?? shown} size={size} part="top" />
      </View>
      {/* bottom: the old character until the new flap lands on it */}
      <View style={[styles.half, styles.bottom, half]}>
        <Glyph c={shown} size={size} part="bottom" />
      </View>
      {next !== null && !reduce ? (
        <>
          <Animated.View style={[styles.half, styles.top, half, styles.flap, { transformOrigin: 'bottom' }, fallStyle]}>
            <Glyph c={shown} size={size} part="top" />
          </Animated.View>
          <Animated.View style={[styles.half, styles.bottom, half, styles.flap, { transformOrigin: 'top' }, landStyle]}>
            <Glyph c={next} size={size} part="bottom" />
          </Animated.View>
        </>
      ) : null}
      <View style={[styles.line, { height: Math.max(1, Math.round(size / 40)) }]} />
    </View>
  );
}

/** One half of a character: the full glyph, clipped by its half */
function Glyph({ c, size, part }: { c: string; size: number; part: 'top' | 'bottom' }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, height: size, top: part === 'top' ? 0 : -size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.62, fontWeight: '600', color: FG, fontVariant: ['tabular-nums'], includeFontPadding: false }}>{c}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tile: { backgroundColor: BG, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  half: { position: 'absolute', left: 0, right: 0, overflow: 'hidden', backgroundColor: BG },
  top: { top: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  bottom: { bottom: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  flap: { backfaceVisibility: 'hidden', zIndex: 2 },
  line: { position: 'absolute', left: 0, right: 0, top: '50%', zIndex: 3, backgroundColor: LINE },
});
