import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { colors, fontWeight } from '@/theme';

/**
 * Card swap (StackD Kit 17) in React Native, for her documents.
 * A stack of cards in depth: each one a step further back and up to the right, slanted.
 * Drag or fling the front card and it goes to the back while the rest step forward; a short drag
 * springs back. A tap on the front card opens it. Only a few cards show; the rest wait behind.
 * Each position in the stack is a fixed transform, so a swap just gives every card a new slot and
 * the card glides there. Cards are drawn back to front (the order on screen is the paint order).
 */

export type SwapItem = {
  id: string;
  title: string;
  sub: string;
  /** A short tag in the corner (PDF, FOTO) */
  tag: string;
  /** For photos: unlocked only when the card is near the front */
  loadImage?: () => Promise<string>;
};

type Props = {
  items: SwapItem[];
  onOpen: (id: string) => void;
  /** Bring this card to the front (Ask Hilo found it) */
  frontId?: string;
  /** Read aloud with the front card ("Double tap to open…") */
  hint: string;
  nextLabel: string;
  cardWidth?: number;
  cardHeight?: number;
};

const STEP = { x: 26, y: 20, z: 70 };
const SKEW = 6;
const PERSP = 1000;
const SHOWN = 4; // cards visible in the stack
const TONES = ['#FFFFFF', '#ECEAE5', '#DAD7D0', '#F4F2EE'];
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const LINES = [0.82, 0.7, 0.86, 0.6, 0.78, 0.66, 0.8, 0.5];

/** How far a card sits for slot k */
function place(k: number) {
  'worklet';
  return { x: k * STEP.x, y: -k * STEP.y, f: PERSP / (PERSP + k * STEP.z) };
}

export function CardSwap({ items, onOpen, frontId, hint, nextLabel, cardWidth: CW = 230, cardHeight: CH = 290 }: Props) {
  const reduce = useReducedMotion();
  const n = items.length;
  const idKey = items.map((i) => i.id).join('|');

  // The order is a turn of the list (newest first); a new list starts again from the front
  const [turn, setTurn] = useState({ key: idKey, by: 0 });
  if (turn.key !== idKey) setTurn({ key: idKey, by: 0 });
  // Asked for a card: turn the stack until it's in front
  const [asked, setAsked] = useState(frontId);
  if (frontId !== asked) {
    setAsked(frontId);
    const i = items.findIndex((x) => x.id === frontId);
    if (i >= 0) setTurn({ key: idKey, by: i });
  }
  const by = turn.key === idKey ? turn.by : 0;
  const slotOf = (i: number) => (((i - by) % n) + n) % n;
  const [leaving, setLeaving] = useState<string | null>(null);
  // After the first frame, cards that join the stack come in from the back
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  // Each card's own drag offset, so the one sent back carries its throw while it glides away
  const offsets = useRef(new Map<string, { x: SharedValue<number>; y: SharedValue<number> }>());
  const env = useRef({ n, items, by, reduce, onOpen });
  useEffect(() => {
    env.current = { n, items, by, reduce, onOpen };
  });

  const next = () => {
    const e = env.current;
    if (e.n < 2) return;
    const front = e.items[((e.by % e.n) + e.n) % e.n];
    setLeaving(front.id);
    setTurn((t) => ({ ...t, by: t.by + 1 }));
  };

  // The gesture is on the stage: only the front card moves, on a rubber band
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const rub = (d: number) => 140 * Math.tanh(d / 140);
    const frontOffset = () => {
      const e = env.current;
      const front = e.items[((e.by % e.n) + e.n) % e.n];
      return front ? offsets.current.get(front.id) : undefined;
    };
    let t0 = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        t0 = Date.now();
      },
      onPanResponderMove: (_, g) => {
        const o = frontOffset();
        o?.x.set(rub(g.dx));
        o?.y.set(rub(g.dy));
      },
      onPanResponderRelease: (_, g) => {
        const e = env.current;
        const o = frontOffset();
        const far = Math.hypot(g.dx, g.dy);
        const quick = far / Math.max(1, Date.now() - t0) > 0.6 || Math.hypot(g.vx, g.vy) > 0.6;
        if (far < 6) {
          const front = e.items[((e.by % e.n) + e.n) % e.n];
          if (front) e.onOpen(front.id);
          return;
        }
        if (far > 70 || (quick && far > 24)) return next();
        o?.x.set(withSpring(0, { damping: 14, stiffness: 220 }));
        o?.y.set(withSpring(0, { damping: 14, stiffness: 220 }));
      },
      onPanResponderTerminate: () => {
        const o = frontOffset();
        o?.x.set(withSpring(0));
        o?.y.set(withSpring(0));
      },
    });
  });

  // The box the stack really fills: every visible card's corners, slanted and stepped back
  const tan = Math.tan((SKEW * Math.PI) / 180);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < Math.max(1, Math.min(n, SHOWN)); k++) {
    const { x, y, f } = place(k);
    for (const u of [-CW / 2, CW / 2])
      for (const v of [-CH / 2, CH / 2]) {
        const px = CW / 2 + x + f * u;
        const py = CH / 2 + y + f * (v + u * tan);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
  }

  if (!n) return null;
  // Back to front: the order on screen is the paint order
  const drawn = items
    .map((item, i) => ({ item, slot: slotOf(i) }))
    .filter(({ item, slot }) => slot < SHOWN || item.id === leaving)
    .sort((a, b) => b.slot - a.slot);
  const front = drawn[drawn.length - 1]?.item;

  return (
    <View
      style={{
        width: Math.ceil(maxX - minX),
        height: Math.ceil(maxY - minY),
        alignSelf: 'center',
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={front ? `${front.title}, ${front.sub}` : undefined}
      accessibilityHint={hint}
      accessibilityActions={[{ name: 'activate' }, { name: 'next', label: nextLabel }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'next') next();
        else if (front) onOpen(front.id);
      }}
      {...pan.panHandlers}>
      <View
        style={{
          position: 'absolute',
          left: -minX,
          top: -minY,
          width: CW,
          height: CH,
        }}>
        {drawn.map(({ item, slot }) => (
          <Card
            key={item.id}
            item={item}
            slot={slot}
            tone={TONES[items.indexOf(item) % TONES.length]}
            width={CW}
            height={CH}
            reduce={reduce}
            fromBack={ready}
            register={(o) => {
              if (o) offsets.current.set(item.id, o);
              else offsets.current.delete(item.id);
            }}
            onSettled={() => setLeaving((l) => (l === item.id ? null : l))}
          />
        ))}
      </View>
    </View>
  );
}

type CardProps = {
  item: SwapItem;
  slot: number;
  tone: string;
  width: number;
  height: number;
  reduce: boolean;
  fromBack: boolean;
  register: (o: { x: SharedValue<number>; y: SharedValue<number> } | null) => void;
  onSettled: () => void;
};

function Card({ item, slot, tone, width, height, reduce, fromBack, register, onSettled }: CardProps) {
  const s = useSharedValue(fromBack && !reduce ? SHOWN : slot);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    register({ x: ox, y: oy });
    return () => register(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new slot: glide there; a card thrown to the back lets go of its throw on the way
  useEffect(() => {
    const ms = reduce ? 0 : 600;
    s.set(withTiming(slot, { duration: ms, easing: EASE }));
    if (slot > 0) {
      ox.set(withTiming(0, { duration: ms, easing: EASE }));
      oy.set(withTiming(0, { duration: ms, easing: EASE }));
    }
    const t = setTimeout(onSettled, ms + 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  // A photo is unlocked only when it comes near the front
  const near = slot < 3;
  useEffect(() => {
    if (!near || image || !item.loadImage) return;
    let live = true;
    item
      .loadImage()
      .then((uri) => live && setImage(uri))
      .catch(() => {});
    return () => {
      live = false;
    };
    // the card's id, not the object (rebuilt on every render of the list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, image, item.id]);

  const style = useAnimatedStyle(() => {
    const { x, y, f } = place(s.value);
    return {
      opacity: interpolate(s.value, [SHOWN - 1, SHOWN], [1, 0], 'clamp'),
      transform: [{ translateX: x + ox.value }, { translateY: y + oy.value }, { scale: f }, { skewY: `${SKEW}deg` }, { rotate: `${ox.value * 0.05}deg` }],
    };
  });

  return (
    <Animated.View style={[styles.card, { width, height }, style]} pointerEvents="none">
      <View style={[styles.face, { backgroundColor: tone }]}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.paper}>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>{item.tag}</Text>
            </View>
            <Text style={styles.title} numberOfLines={3}>
              {item.title}
            </Text>
            <Text style={styles.sub}>{item.sub}</Text>
            <View style={styles.lines}>
              {LINES.map((w, i) => (
                <View key={i} style={[styles.line, { width: `${w * 100}%` }]} />
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // A soft shadow parts each card from the one behind; the face inside is clipped to the corners
  card: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 20,
    shadowColor: '#141310',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  face: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  paper: { flex: 1, padding: 20 },
  tagRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  tag: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
    color: colors.onAccent,
    backgroundColor: colors.ink,
  },
  title: {
    marginTop: 18,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: 'rgba(20,19,16,0.45)',
  },
  lines: { marginTop: 22, gap: 11 },
  line: { height: 6, borderRadius: 3, backgroundColor: 'rgba(20,19,16,0.08)' },
  pill: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    maxWidth: '85%',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
});
