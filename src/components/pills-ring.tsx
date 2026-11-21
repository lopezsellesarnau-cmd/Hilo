import { useEffect, useState } from 'react';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Today's pills as a ring (the StackD Spending ring, Kit 25, with one pill per dose): a thick capsule for
 * each dose, black when taken, grey when not. They pour in one after another from the top while the
 * number counts up. When every dose is taken, the gaps close and it becomes one full ring.
 */

type Props = { taken: number; total: number; size?: number };

const STROKE = 10;
const R = 34; // in an 84-unit box, like the ring it replaces
const GREY = '#dcdcdc';
const POUR = 160; // ms per dose

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** An arc from a to b, in degrees clockwise from the top */
function arc(a: number, b: number) {
  'worklet';
  if (b - a < 0.5) return 'M42 42';
  const p = (deg: number) => {
    const t = ((deg - 90) * Math.PI) / 180;
    return `${42 + R * Math.cos(t)} ${42 + R * Math.sin(t)}`;
  };
  // A full turn can't be one arc: two halves
  if (b - a >= 359.5) return `M${p(0)}A${R} ${R} 0 1 1 ${p(180)}A${R} ${R} 0 1 1 ${p(359.9)}`;
  return `M${p(a)}A${R} ${R} 0 ${b - a > 180 ? 1 : 0} 1 ${p(b)}`;
}

function Dose({ i, total, poured, gap, taken }: { i: number; total: number; poured: SharedValue<number>; gap: SharedValue<number>; taken: boolean }) {
  const props = useAnimatedProps(() => {
    const slice = 360 / total;
    // The round ends reach past the arc: the gap leaves room for them
    const g = total > 1 ? gap.value : 0;
    const start = i * slice + g / 2;
    const full = slice - g;
    const grown = Math.min(1, Math.max(0, poured.value - i));
    return { d: arc(start, start + full * grown) };
  });
  return <AnimatedPath animatedProps={props} stroke={taken ? colors.ink : GREY} strokeWidth={STROKE} strokeLinecap="round" fill="none" />;
}

export function PillsRing({ taken, total, size = 84 }: Props) {
  const reduceMotion = useReducedMotion();
  const done = total > 0 && taken >= total;
  // Room for the round ends plus a small gap, but never more than half a slice
  const open = Math.min(((STROKE + 5) / R) * (180 / Math.PI), (360 / Math.max(1, total)) * 0.5);

  const poured = useSharedValue(reduceMotion ? total : 0);
  const gap = useSharedValue(done && reduceMotion ? 0 : open);
  const [shown, setShown] = useState(reduceMotion ? taken : 0);

  // Pour in, dose by dose; all taken: the gaps close after it lands
  useEffect(() => {
    if (reduceMotion) {
      poured.value = total;
      gap.value = done ? 0 : open;
      return;
    }
    poured.value = 0;
    poured.value = withTiming(total, { duration: POUR * total });
    gap.value = done ? withDelay(POUR * total + 150, withTiming(0, { duration: 450 })) : withTiming(open, { duration: 300 });
  }, [taken, total, done, open, reduceMotion, poured, gap]);

  // The number counts up with the black doses
  useEffect(() => {
    const steps = reduceMotion ? [[0, taken]] : [[0, 0], ...Array.from({ length: taken }, (_, i) => [POUR * (i + 1), i + 1])];
    const timers = steps.map(([ms, n]) => setTimeout(() => setShown(n), ms));
    return () => timers.forEach(clearTimeout);
  }, [taken, reduceMotion]);

  return (
    <Svg width={size} height={size} viewBox="0 0 84 84">
      {total ? null : <Circle cx={42} cy={42} r={R} fill="none" stroke={GREY} strokeWidth={STROKE} />}
      {Array.from({ length: total }, (_, i) => (
        <Dose key={`${i}-${total}`} i={i} total={total} poured={poured} gap={gap} taken={i < taken} />
      ))}
      <SvgText x={42} y={49} textAnchor="middle" fill={colors.ink} fontSize={22} fontWeight="800">
        {`${shown}/${total}`}
      </SvgText>
    </Svg>
  );
}
