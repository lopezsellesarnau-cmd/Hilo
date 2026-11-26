import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, fontWeight } from '@/theme';

/**
 * Wheel picker (the StackD Wheel picker, for React Native).
 * The options sit on a vertical wheel. At rest only the chosen one shows; spin and the
 * neighbours come out, curving back on the wheel; it snaps onto an option.
 * Same props as ChoiceChips, so it drops in where the chips were.
 */

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Read by VoiceOver, e.g. "Hora de la charla" */
  label: string;
  /** One row, in pt. */
  itemHeight?: number;
  /** The page colour behind it, for the fades. */
  background?: string;
  /** Size of the labels. Default 34. */
  fontSize?: number;
};

const ROWS = 3.4; // the wheel's height, in rows
const STEP = 24; // degrees between two rows on the wheel

export function WheelPicker<T extends string>({ options, value, onChange, label, itemHeight = 60, background = colors.background, fontSize = 34 }: Props<T>) {
  const h = itemHeight;
  const height = Math.round(h * ROWS);
  const pad = (height - h) / 2;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const reduceMotion = useReducedMotion();

  const ref = useAnimatedRef<Animated.ScrollView>();
  const y = useSharedValue(index * h);
  const spinning = useSharedValue(0);
  const passing = useSharedValue(index); // the row in the middle right now, for the tick
  const last = useRef(index);
  const tick = () => {
    Haptics.selectionAsync().catch(() => {});
  };

  // Follow a value set from outside (e.g. loaded from the server)
  useEffect(() => {
    if (index === last.current) return;
    last.current = index;
    ref.current?.scrollTo({ y: index * h, animated: !reduceMotion });
  }, [index, h, ref, reduceMotion]);

  const settle = (offset: number) => {
    const i = Math.min(options.length - 1, Math.max(0, Math.round(offset / h)));
    if (i === last.current) return;
    last.current = i;
    onChange(options[i].value);
  };

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.value = e.contentOffset.y;
      // a light tick as each option passes the middle, like the iOS picker
      const mid = Math.round(e.contentOffset.y / h);
      if (mid !== passing.value && mid >= 0 && mid < options.length) {
        passing.value = mid;
        runOnJS(tick)();
      }
    },
    onBeginDrag: () => {
      spinning.value = withTiming(1, { duration: 160 });
    },
    onEndDrag: (e) => {
      // a slow release still snaps; settle here in case no momentum follows
      if (Math.abs(e.velocity?.y ?? 0) < 0.05) {
        spinning.value = withTiming(0, { duration: 500 });
        runOnJS(settle)(e.contentOffset.y);
      }
    },
    onMomentumEnd: (e) => {
      spinning.value = withTiming(0, { duration: 500 });
      runOnJS(settle)(e.contentOffset.y);
    },
  });

  // VoiceOver: swipe up or down on it to change, like a native picker
  const onAction = (e: AccessibilityActionEvent) => {
    const i = Math.min(options.length - 1, Math.max(0, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
    if (i === index) return;
    last.current = i;
    ref.current?.scrollTo({ y: i * h, animated: false });
    onChange(options[i].value);
  };

  return (
    <View
      style={{ height }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: options[index]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAction}>
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={h}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * h }}
        contentContainerStyle={{ paddingVertical: pad }}>
        {options.map((o, i) => (
          <Row key={o.value} label={o.label} i={i} h={h} y={y} spinning={spinning} fontSize={fontSize} />
        ))}
      </Animated.ScrollView>
      {/* the top and bottom fade away */}
      <LinearGradient pointerEvents="none" colors={[background, `${background}00`]} style={[styles.fade, { top: 0, height: pad }]} />
      <LinearGradient pointerEvents="none" colors={[`${background}00`, background]} style={[styles.fade, { bottom: 0, height: pad }]} />
    </View>
  );
}

function Row({ label, i, h, y, spinning, fontSize }: { label: string; i: number; h: number; y: SharedValue<number>; spinning: SharedValue<number>; fontSize: number }) {
  const style = useAnimatedStyle(() => {
    const d = i - y.value / h; // rows from the middle
    const near = Math.max(0, 1 - Math.abs(d));
    const opacity = near + (1 - near) * spinning.value * Math.max(0, 0.7 - Math.abs(d) * 0.18);
    const a = Math.max(-80, Math.min(80, d * STEP));
    return {
      opacity,
      transform: [{ perspective: h * 8 }, { rotateX: `${-a}deg` }, { scale: interpolate(Math.abs(d), [0, 2], [1, 0.86], 'clamp') }],
    };
  });
  return (
    <Animated.View style={[styles.row, { height: h }, style]}>
      <Text style={[styles.label, { fontSize }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 34, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.ink, fontVariant: ['tabular-nums'] },
  fade: { position: 'absolute', left: 0, right: 0 },
});
