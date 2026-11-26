import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { LiveBot } from '@/components/live-bot';
import { colors, fontWeight } from '@/theme';

/**
 * File drop (StackD Kit 13) in React Native: the pieces shared by story photos and documents.
 * A dashed zone with her Bot (the shape she chose) in the middle; what you add goes into its mouth,
 * it chews, and comes out below as rows with a rolling percentage and a bar.
 */

/** The Bot's mouth and squash, and the chew that plays when files go in */
export function useChew() {
  const reduce = useReducedMotion();
  const mouth = useSharedValue(0); // 0 closed, 1 wide
  const squash = useSharedValue(1);
  useEffect(() => () => cancelAnimation(mouth), [mouth]);
  const chew = () => {
    if (reduce) return;
    // it opens wide, takes them in, chews three times, closes
    mouth.set(
      withSequence(
        withTiming(1, { duration: 160 }),
        withRepeat(withSequence(withTiming(0.25, { duration: 110 }), withTiming(0.8, { duration: 110 })), 3),
        withTiming(0, { duration: 160 }),
      ),
    );
    squash.set(withSequence(withTiming(0.88, { duration: 120 }), withSpring(1, { damping: 6, stiffness: 260 })));
  };
  return { mouth, squash, chew };
}

type ZoneProps = { title: string; hint: string; onPress: () => void; mouth: SharedValue<number>; squash: SharedValue<number>; size?: number };

export function DropZone({ title, hint, onPress, mouth, squash, size = 64 }: ZoneProps) {
  const bot = useAnimatedStyle(() => ({ transform: [{ scaleY: squash.value }, { scaleX: 2 - squash.value }] }));
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} style={({ pressed }) => [styles.zone, pressed && styles.zonePressed]}>
      <Animated.View style={bot}>
        <LiveBot size={size} voice={mouth} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}

type RowProps = {
  /** A picture for the thumbnail, or a short tag (PDF) on a dark tile */
  thumb?: string;
  tag?: string;
  /** Left of the percentage: "Uploading", a file name… */
  label: string;
  progress: number;
  failed?: boolean;
  onRemove?: () => void;
  removeLabel: string;
};

export function DropRow({ thumb, tag, label, progress, failed, onRemove, removeLabel }: RowProps) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(15)} layout={reduce ? undefined : LinearTransition.springify().damping(18)} style={styles.row}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.tagTile]}>
          <Text style={styles.tag}>{tag}</Text>
        </View>
      )}
      <View style={styles.rowMid}>
        <View style={styles.rowTop}>
          <Text style={styles.rowText} numberOfLines={1}>
            {failed && !label ? '!' : label}
          </Text>
          <Text style={styles.pct}>{failed ? '' : `${Math.round(progress * 100)}%`}</Text>
        </View>
        <View style={styles.track}>
          <Bar progress={progress} failed={failed} />
        </View>
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={removeLabel} hitSlop={10} style={styles.x}>
          <Text style={styles.xText}>✕</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function Bar({ progress, failed }: { progress: number; failed?: boolean }) {
  const w = useSharedValue(progress);
  useEffect(() => {
    w.value = withTiming(progress, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [progress, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <Animated.View style={[styles.bar, failed && styles.barFailed, style]} />;
}

/** A rolling percentage while something goes up (Supabase gives no progress): eases towards 90 % */
export const creep = (p: number) => Math.min(0.9, p + (0.9 - p) * 0.18);

const styles = StyleSheet.create({
  zone: { alignItems: 'center', paddingVertical: 22, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.18)', backgroundColor: colors.background },
  zonePressed: { backgroundColor: colors.surface },
  title: { marginTop: 12, fontSize: 17, fontWeight: fontWeight.bold, color: colors.ink },
  hint: { marginTop: 4, fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: colors.surface },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#e6e6e6' },
  tagTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  tag: { fontSize: 13, fontWeight: fontWeight.bold, letterSpacing: 0.5, color: colors.onAccent },
  rowMid: { flex: 1, gap: 8 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowText: { flex: 1, fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  pct: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.ink, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.08)' },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.ink },
  barFailed: { backgroundColor: colors.error },
  x: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  xText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
});
