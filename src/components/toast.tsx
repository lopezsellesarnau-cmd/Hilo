import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiveBot } from '@/components/live-bot';
import { colors, fontWeight } from '@/theme';

/**
 * Toast (StackD Kit 23, calmer): the Bot drops in like a drop of ink, lands with a squash and unrolls into
 * a white pill with the message. Failed: it turns red and the pill shakes once. Leaving, the pill rolls
 * back into the Bot and it drops away. One at a time: a new toast replaces the one on screen.
 *
 *   <Toaster />                         once, in the root layout
 *   toast('Saved')                      from anywhere
 *   toast.error("Couldn't save")
 *   toast('Marked as done', { action: { label: 'Undo', onPress: undo } })
 *
 * Not on the senior side: there, confirmations stay next to what she tapped (like Undo under a pill).
 */

type Kind = 'info' | 'error';
type Action = { label: string; onPress: () => void };
type Item = { id: number; kind: Kind; title: string; action?: Action };

// The store: module state, so toast() works from any screen
let current: Item | null = null;
let next = 1;
const subs = new Set<() => void>();
const set = (item: Item | null) => {
  current = item;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export const toast = Object.assign((title: string, o?: { action?: Action }) => set({ id: next++, kind: 'info', title, action: o?.action }), {
  error: (title: string) => set({ id: next++, kind: 'error', title }),
  dismiss: () => set(null),
});

const H = 56; // the pill's height
const HEAD = 40; // the Bot inside it
const PAD = (H - HEAD) / 2;

/** Where toasts appear. `bottom`: extra room at the bottom (the family tab bar). */
export function Toaster({ bottom = 0 }: { bottom?: number }) {
  const item = useSyncExternalStore(subscribe, () => current);
  const insets = useSafeAreaInsets();
  if (!item) return null;
  return (
    <View pointerEvents="box-none" style={[styles.layer, { bottom: insets.bottom + bottom + 16 }]}>
      {/* A new key per toast: the old one goes, the new one drops in */}
      <ToastView key={item.id} item={item} />
    </View>
  );
}

function ToastView({ item }: { item: Item }) {
  const reduceMotion = useReducedMotion();
  const [content, setContent] = useState(0);
  const error = item.kind === 'error';

  const y = useSharedValue(reduceMotion ? 0 : 70);
  const squash = useSharedValue(1);
  const width = useSharedValue(H);
  const words = useSharedValue(reduceMotion ? 1 : 0);
  const shake = useSharedValue(0);
  const fade = useSharedValue(reduceMotion ? 0 : 1);

  const full = content ? HEAD + PAD + 12 + content + (item.action ? 0 : 20) : H;
  const ready = content > 0;
  const unrolled = useRef(false);

  // Drop in and land with a squash, once the message has been measured
  useEffect(() => {
    if (!ready) return;
    if (reduceMotion) {
      fade.value = withTiming(1, { duration: 200 });
      return;
    }
    y.value = withSpring(0, { damping: 14, stiffness: 160 });
    squash.value = withDelay(260, withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 260 })));
    words.value = withDelay(560, withTiming(1, { duration: 260 }));
    if (error) shake.value = withDelay(900, withSequence(...[-8, 7, -5, 3, 0].map((x) => withTiming(x, { duration: 70 }))));
  }, [ready, error, reduceMotion, y, squash, words, shake, fade]);

  // Unroll to the message's width; if it's measured again bigger (a button settling), follow it
  useEffect(() => {
    if (!ready) return;
    const first = !unrolled.current;
    unrolled.current = true;
    if (reduceMotion) width.value = full;
    else width.value = withDelay(first ? 420 : 0, withSpring(full, { damping: 15, stiffness: 140 }));
  }, [ready, full, reduceMotion, width]);

  // Gone after 4 s (6 s with a button): roll back into the Bot, then drop away
  useEffect(() => {
    if (!ready) return;
    const close = () => {
      if (current?.id === item.id) toast.dismiss();
    };
    const timer = setTimeout(() => {
      if (reduceMotion) {
        fade.value = withTiming(0, { duration: 200 }, (ok) => ok && runOnJS(close)());
        return;
      }
      words.value = withTiming(0, { duration: 120 });
      width.value = withTiming(H, { duration: 300 });
      y.value = withDelay(280, withTiming(80, { duration: 380 }, (ok) => ok && runOnJS(close)()));
      fade.value = withDelay(380, withTiming(0, { duration: 280 }));
    }, item.action ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [ready, item.id, item.action, reduceMotion, words, width, y, fade]);

  const pill = useAnimatedStyle(() => ({
    width: width.value,
    opacity: fade.value,
    transform: [{ translateY: y.value }, { translateX: shake.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  // The white sheet only shows once it starts to unroll: falling, it's just the Bot
  const sheet = useAnimatedStyle(() => ({ opacity: Math.min(1, (width.value - H) / 12) }));
  const message = useAnimatedStyle(() => ({ opacity: words.value }));

  return (
    <Animated.View
      style={[styles.pill, pill]}
      accessible
      accessibilityRole={error ? 'alert' : 'text'}
      accessibilityLiveRegion={error ? 'assertive' : 'polite'}
      accessibilityLabel={item.title}>
      <Animated.View style={[styles.sheet, sheet]} />
      <View style={styles.head}>
        <LiveBot size={HEAD} color={error ? colors.error : colors.ink} look="right" />
      </View>
      <Animated.View style={[styles.row, message]}>
        {/* Measured once, inside a wide row so nothing is squeezed, to know how far to unroll */}
        <View style={styles.content} onLayout={(e) => setContent(Math.ceil(e.nativeEvent.layout.width))}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {item.action ? (
          <Pressable
            onPress={() => {
              item.action?.onPress();
              toast.dismiss();
            }}
            accessibilityRole="button"
            style={styles.action}>
            <Text style={styles.actionText}>{item.action.label}</Text>
          </Pressable>
        ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    height: H,
    borderRadius: H / 2,
    overflow: 'hidden',
  },
  sheet: {
    ...StyleSheet.absoluteFill,
    borderRadius: H / 2,
    backgroundColor: colors.background,
    // A soft shadow so the white pill reads on a white page
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 14px 34px rgba(20,19,16,.13), 0 0 0 1px rgba(20,19,16,.06)' }
      : { borderWidth: 1, borderColor: 'rgba(20,19,16,0.08)' }),
  },
  head: {
    position: 'absolute',
    left: PAD,
    top: PAD,
  },
  // Wider than any message, so the content inside is measured at its real width
  row: {
    position: 'absolute',
    left: HEAD + PAD + 12,
    top: 0,
    bottom: 0,
    width: 640,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  action: {
    height: 36,
    paddingHorizontal: 14,
    marginRight: 10,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  actionText: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
});
