import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors, fontWeight } from "@/theme";

/**
 * Record flow (the StackD component, kit/src/components/RecordFlow.tsx), vertical, for React Native.
 * Cards on a dark tray: the one in the middle faces you with its title; the others fan out above and
 * below, each tucked under the next, their outer edge tall, in shadow with distance. Drag 1:1, a flick
 * carries up to two cards, it settles quart-out. Tap the middle card to open it, another to bring it in.
 */

export type FlowItem = {
  id: string;
  title: string;
  sub?: string;
  badge?: string;
  cover: ReactNode;
};

type Props = {
  items: FlowItem[];
  start?: number;
  onOpen: (index: number) => void;
  /** Read by VoiceOver for the whole tray */
  label: string;
};

const clamp = (v: number, a: number, b: number) => {
  "worklet";
  return Math.min(b, Math.max(a, v));
};

export function RecordFlow({ items, start, onOpen, label }: Props) {
  const n = items.length;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const S = Math.min(box.w * 0.66, box.h * 0.5); // the card
  const reduce = useReducedMotion();
  const pos = useSharedValue(start ?? n - 1);
  const [front, setFront] = useState(Math.round(start ?? n - 1));

  useAnimatedReaction(
    () => Math.round(clamp(pos.value, 0, n - 1)),
    (f, prev) => {
      if (f !== prev) runOnJS(setFront)(f);
    },
  );

  const boxH = useRef(0); // the tray's height, for where a tap lands
  // what the gesture needs, fresh after each render (read only in the handlers)
  const env = useRef({ S, n, reduce, onOpen, front });
  useEffect(() => {
    env.current = { S, n, reduce, onOpen, front };
  });

  // The ref and the shared value are read only inside the gesture handlers
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const glide = (to: number) => {
      const e = env.current;
      const target = clamp(Math.round(to), 0, e.n - 1);
      pos.value = e.reduce
        ? target
        : withTiming(target, {
            duration: 640,
            easing: Easing.out(Easing.poly(4)),
          });
    };
    let p0 = 0;
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        p0 = pos.value;
        pos.value = p0; // stop a glide under the finger
        moved = false;
      },
      onPanResponderMove: (_, g) => {
        const e = env.current;
        if (Math.abs(g.dy) > 4) moved = true;
        let p = p0 - g.dy / (e.S * 0.5);
        // a little give past the ends
        if (p < 0) p = -0.5 * (1 - 1 / (1 - p));
        if (p > e.n - 1) p = e.n - 1 + 0.5 * (1 - 1 / (1 + p - (e.n - 1)));
        pos.value = p;
      },
      onPanResponderRelease: (ev, g) => {
        const e = env.current;
        if (!moved) {
          // a tap: the middle card opens; one above or below comes to the middle
          const y = ev.nativeEvent.locationY;
          const mid = boxH.current / 2;
          const off = (y - mid) / (e.S * 0.66);
          if (Math.abs(off) < 0.5) e.onOpen(e.front);
          else
            glide(
              pos.value +
                Math.sign(off) * Math.min(2, Math.round(Math.abs(off) + 0.2)),
            );
          return;
        }
        // the flick carries up to two cards
        const fling = clamp(-g.vy * 0.9, -2, 2);
        glide(pos.value + fling);
      },
    });
  });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    boxH.current = h;
    setBox({ w, h });
  };

  return (
    <View
      style={styles.tray}
      onLayout={onLayout}
      {...pan.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{
        text: items[front]
          ? `${items[front].title}, ${front + 1} / ${n}`
          : undefined,
      }}
      accessibilityActions={[
        { name: "increment" },
        { name: "decrement" },
        { name: "activate" },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "activate") return onOpen(front);
        const to = clamp(
          front + (e.nativeEvent.actionName === "increment" ? 1 : -1),
          0,
          n - 1,
        );
        pos.set(to);
      }}
    >
      {S > 0
        ? // painted farthest first, so the ones nearer the middle sit on top (zIndex in an animated style isn't
          // reliable on iOS); re-sorted whenever the middle card changes
          items
            .map((it, i) => ({ it, i }))
            .sort((a, b) => Math.abs(b.i - front) - Math.abs(a.i - front))
            .map(({ it, i }) => (
              <Card key={it.id} item={it} i={i} pos={pos} S={S} />
            ))
        : null}
      {/* the far cards fade into the tray, top and bottom */}
      <LinearGradient
        pointerEvents="none"
        colors={[TRAY, `${TRAY}00`]}
        style={[styles.fade, { top: 0 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${TRAY}00`, TRAY]}
        style={[styles.fade, { bottom: 0 }]}
      />
    </View>
  );
}

export const TRAY = "#0b0a09";

function Card({
  item,
  i,
  pos,
  S,
}: {
  item: FlowItem;
  i: number;
  pos: SharedValue<number>;
  S: number;
}) {
  const P = S * 3.6;
  const card = useAnimatedStyle(() => {
    const o = i - pos.value;
    const d = Math.abs(o);
    const side = Math.sign(o);
    const k = Math.min(d, 1);
    const along = side * (k * S * 0.66 + Math.max(0, d - 1) * S * 0.28);
    const turn = -side * k * 66;
    const back = -k * S * 0.2;
    // no translateZ in React Native: the same depth as a scale through the perspective
    const depth = P / (P - back);
    return {
      zIndex: 1000 - Math.round(d * 100),
      opacity: d > 3.2 ? 0 : 1,
      transform: [
        { translateY: along },
        { perspective: P },
        { rotateX: `${-turn}deg` },
        { scale: depth },
      ],
      // iOS draws a view's shadow from its flat box, not the tilted card: on the side cards it showed as a
      // dark block. Only the card in the middle (flat) casts one.
      shadowOpacity: clamp(1 - d * 1.5, 0, 1) * 0.55,
    };
  });
  // Each card casts a soft shadow past its outer edge, onto the card behind it (the one further out).
  // Cards above the middle throw it upwards, cards below downwards; the middle one both ways.
  // Its own face only gets a touch darker with distance: no grey bands on the card itself.
  const base = useAnimatedStyle(() => ({
    opacity: clamp(Math.abs(i - pos.value) * 0.05, 0, 0.2),
  }));
  const castUp = useAnimatedStyle(() => ({
    opacity: clamp(1 - (i - pos.value), 0, 1),
  })); // at or above the middle
  const castDown = useAnimatedStyle(() => ({
    opacity: clamp(1 + (i - pos.value), 0, 1),
  })); // at or below the middle
  const title = useAnimatedStyle(() => ({
    opacity: clamp(1 - Math.abs(i - pos.value) * 2.5, 0, 1),
  }));

  return (
    // Its own flat layer: on iOS, tilted siblings in one layer cut through each other (and through the fades)
    // where the tilt crosses the screen plane, a hard grey line across each card. Flattened, they just stack.
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.slot,
          { width: S, height: S, marginLeft: -S / 2, marginTop: -S / 2 },
          card,
        ]}
      >
        <Animated.View
          style={[
            styles.cast,
            { top: -S * 0.5, height: S * 0.5, left: S * 0.02, right: S * 0.02 },
            castUp,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(0,0,0,0)",
              "rgba(0,0,0,0.06)",
              "rgba(0,0,0,0.2)",
              "rgba(0,0,0,0.45)",
            ]}
            locations={[0, 0.45, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.cast,
            {
              bottom: -S * 0.5,
              height: S * 0.5,
              left: S * 0.02,
              right: S * 0.02,
            },
            castDown,
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.45)",
              "rgba(0,0,0,0.2)",
              "rgba(0,0,0,0.06)",
              "rgba(0,0,0,0)",
            ]}
            locations={[0, 0.2, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={[styles.face, { borderRadius: S * 0.09 }]}>
          {item.cover}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.shade, base]}
          />
          <Animated.View style={[styles.titleWrap, title]}>
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
          </Animated.View>
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { flex: 1, backgroundColor: TRAY, overflow: "hidden" },
  slot: {
    position: "absolute",
    left: "50%",
    top: "50%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 22,
  },
  face: { flex: 1, overflow: "hidden" },
  shade: { backgroundColor: "#000" },
  cast: { position: "absolute" },
  titleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    color: colors.onAccent,
    textAlign: "center",
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: "rgba(255,255,255,0.7)",
  },
  badge: {
    position: "absolute",
    top: 12,
    right: 12,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 10,
    justifyContent: "center",
    backgroundColor: colors.onAccent,
  },
  badgeText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
  fade: { position: "absolute", left: 0, right: 0, height: "22%" },
});
