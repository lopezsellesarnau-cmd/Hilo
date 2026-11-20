import { useEffect, useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { colors } from '@/theme';

/**
 * Hilo's bot, alive: the black circle with the StackD Bot's tall eyes, a bit bigger
 * (or, with face="thread", Hilo's round eyes joined by a thread).
 * The eyes sit on a sphere (same maths as the StackD Bot): turning away, an eye moves less and gets
 * narrower, so the flat circle reads as round. While her finger is on the screen it looks at it,
 * calmly; when she lets go it drifts back to its resting look. It blinks now and then.
 * Drawn on the UI thread: a finger move is not a React render.
 */

export type BotMood = 'idle' | 'listening' | 'thinking' | 'speaking';

type Point = { x: number; y: number } | null;
/** Where the finger is on screen (null when nobody is touching), for the bots that listen. One per screen. */
export type Finger = { listen: (fn: (p: Point, start: boolean) => void) => () => void };

/** Put the handlers on the screen's root view and pass `finger` to the bot.
 * Touch events reach the root even when a button or the scroll view takes the touch. */
export function useFinger() {
  const [made] = useState(() => {
    const fns = new Set<(p: Point, start: boolean) => void>();
    const send = (p: Point, start: boolean) => fns.forEach((fn) => fn(p, start));
    const at = (start: boolean) => (e: GestureResponderEvent) => send({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }, start);
    const off = () => send(null, false);
    const finger: Finger = {
      listen: (fn) => {
        fns.add(fn);
        return () => {
          fns.delete(fn);
        };
      },
    };
    return { finger, handlers: { onTouchStart: at(true), onTouchMove: at(false), onTouchEnd: off, onTouchCancel: off } };
  });
  return made;
}

type Props = {
  size: number;
  mood?: BotMood;
  /** Which way it looks at rest. */
  look?: 'right' | 'left';
  finger?: Finger;
  /** How loud Hilo's voice is right now, 0 to 1: the mouth opens with it (like the StackD voice memo). */
  voice?: SharedValue<number>;
  /** 'stackd': tall capsule eyes like the StackD Bot, a bit bigger (default). 'thread': Hilo's round eyes joined by a thread. */
  face?: Face;
};

type Face = 'stackd' | 'thread';

// In a 100-unit box. w/h: eye size facing straight on; gap: from the centre to each eye, as a share of
// the sphere; reach: how far the eyes travel from the centre.
const FACES = {
  // The StackD Bot's tall eyes (11 × 21, 13 from the centre) at 1.4×
  stackd: { w: 15.4, h: 29.4, gap: 0.36, reach: 50 },
  // Measured from the 18 oct bot (assets/icons/bot.svg): round eyes, radius 11.5
  thread: { w: 23, h: 23, gap: 0.56, reach: 44 },
};
const THREAD = 3.1; // thread width
const MOUTH = 1.4; // the StackD mouth (12-20 wide, 2.5-11.5 tall) at the same scale as the eyes
const SAG = 0.22; // how much the thread hangs, as a share of its length

// Gentler than the web: she should notice it looking, not be distracted by it
const FOLLOW = 0.7;
const SPRING = { damping: 20, stiffness: 150, mass: 1 };
const BACK = 1200; // ms after she lets go before it drifts back

const REST = { right: { x: 0.35, y: -0.15 }, left: { x: -0.35, y: -0.15 } };
const MOODS = { listening: { x: 0, y: 0 }, thinking: { x: -0.35, y: -0.6 }, speaking: { x: -0.4, y: 0.05 } };

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One eye on the sphere: its box for a look (x, y in -1..1). */
function eye(face: Face, side: number, x: number, y: number, blink: number) {
  'worklet';
  const clamp = (v: number) => Math.min(0.92, Math.max(-0.92, v));
  const yaw = Math.asin(clamp(x));
  const pitch = -Math.asin(clamp(y));
  const f = FACES[face];
  const x0 = side * f.gap;
  const z0 = Math.sqrt(1 - x0 * x0);
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = -z1 * Math.sin(pitch);
  const near = Math.min(1, Math.max(0, z1 * Math.cos(pitch)));
  const k = 0.45 + 0.55 * near;
  const cx = 50 + x1 * f.reach;
  const cy = 50 + y2 * f.reach;
  const w = f.w * k * (0.7 + 0.3 * near);
  const h = f.h * k * blink;
  return { cx, cy, x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: Math.min(w, h) / 2 };
}

/** The mouth: a point on the sphere below the eyes, turned with the head like they are (StackD Bot maths). */
function mouthBox(face: Face, x: number, y: number, open: number) {
  'worklet';
  const clamp = (v: number) => Math.min(0.92, Math.max(-0.92, v));
  const yaw = Math.asin(clamp(x));
  const pitch = -Math.asin(clamp(y));
  const reach = FACES[face].reach;
  const y0 = 0.56;
  const z0 = Math.sqrt(1 - y0 * y0);
  const x1 = z0 * Math.sin(yaw);
  const z1 = z0 * Math.cos(yaw);
  const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const near = Math.min(1, Math.max(0, y0 * Math.sin(pitch) + z1 * Math.cos(pitch)));
  const k = 0.45 + 0.55 * near;
  const o = Math.min(1, Math.max(0, open));
  // Closed: no mouth at all
  const w = o < 0.02 ? 0 : (12 + 8 * o) * MOUTH * k * (0.7 + 0.3 * near);
  const h = o < 0.02 ? 0 : (2.5 + 9 * o) * MOUTH * k;
  const cx = 50 + x1 * reach;
  const cy = 50 + y2 * reach;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: Math.min(w, h) / 2 };
}

export function LiveBot({ size, mood = 'idle', look = 'right', finger, face = 'stackd', voice }: Props) {
  const reduceMotion = useReducedMotion();
  const box = useRef<View>(null);
  // The bot's centre on screen, to aim at the finger
  const centre = useRef({ x: 0, y: 0 });
  const lookX = useSharedValue(REST[look].x);
  const lookY = useSharedValue(REST[look].y);
  const blink = useSharedValue(1);
  const breath = useSharedValue(1);

  const measure = () =>
    box.current?.measureInWindow((x, y, w, h) => {
      centre.current = { x: x + w / 2, y: y + h / 2 };
    });

  // Mood or rest: where it looks when nobody is touching
  const target = mood === 'idle' ? REST[look] : MOODS[mood];
  useEffect(() => {
    const go = (v: number) => (reduceMotion ? withTiming(v, { duration: 0 }) : withSpring(v, SPRING));
    lookX.value = go(target.x);
    lookY.value = go(target.y);
  }, [target.x, target.y, reduceMotion, lookX, lookY]);

  // Follow the finger, only while idle (in a talk the mood decides where it looks)
  useEffect(() => {
    if (!finger || mood !== 'idle') return;
    const go = (v: number) => (reduceMotion ? withTiming(v, { duration: 0 }) : withSpring(v, SPRING));
    let back: ReturnType<typeof setTimeout> | undefined;
    const stop = finger.listen((p, start) => {
      if (back) clearTimeout(back);
      if (!p) {
        back = setTimeout(() => {
          lookX.value = go(target.x);
          lookY.value = go(target.y);
        }, BACK);
        return;
      }
      // The screen may have scrolled since the last touch
      if (start) measure();
      const c = centre.current;
      // Within about one and a half bots of distance the look is already full; further away it saturates
      const dx = (p.x - c.x) / (size * 1.6);
      const dy = (p.y - c.y) / (size * 1.6);
      const d = Math.hypot(dx, dy);
      const s = d > 1 ? 1 / d : 1;
      lookX.value = go(dx * s * FOLLOW);
      lookY.value = go(dy * s * FOLLOW);
    });
    return () => {
      if (back) clearTimeout(back);
      stop();
    };
  }, [finger, mood, size, target.x, target.y, reduceMotion, lookX, lookY]);

  // A blink every 3 to 6 s; a very slight breath. Both off with Reduce Motion.
  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withSequence(withTiming(1.02, { duration: 2000 }), withTiming(1, { duration: 2000 })), -1);
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        () => {
          blink.value = withSequence(withTiming(0.1, { duration: 70 }), withTiming(1, { duration: 110 }));
          next();
        },
        3000 + Math.random() * 3000,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, [reduceMotion, blink, breath]);

  const left = useAnimatedProps(() => {
    const { x, y, width, height, rx } = eye(face, -1, lookX.value, lookY.value, blink.value);
    return { x, y, width, height, rx };
  });
  const right = useAnimatedProps(() => {
    const { x, y, width, height, rx } = eye(face, 1, lookX.value, lookY.value, blink.value);
    return { x, y, width, height, rx };
  });
  // The thread runs from eye to eye and hangs a little, like the logo
  const thread = useAnimatedProps(() => {
    const a = eye(face, -1, lookX.value, lookY.value, 1);
    const b = eye(face, 1, lookX.value, lookY.value, 1);
    const sag = Math.hypot(b.cx - a.cx, b.cy - a.cy) * SAG;
    const mx = (a.cx + b.cx) / 2;
    const my = (a.cy + b.cy) / 2 + sag;
    return { d: `M${a.cx} ${a.cy}Q${mx} ${my} ${b.cx} ${b.cy}` };
  });
  // Only while speaking: if the audio stops without saying so, the mouth still closes
  const speaking = mood === 'speaking';
  const mouth = useAnimatedProps(() => mouthBox(face, lookX.value, lookY.value, voice && speaking ? voice.value : 0));
  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  return (
    <Animated.View
      ref={box}
      onLayout={measure}
      style={[{ width: size, height: size }, breathing]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t.common.assistant}>
      {/* Listening: a ring goes out from it, like before */}
      {mood === 'listening' && !reduceMotion ? (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(300)} pointerEvents="none" style={ring} />
      ) : null}
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="hilo-bot">
            <Circle cx={50} cy={50} r={50} />
          </ClipPath>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={colors.ink} />
        <G clipPath="url(#hilo-bot)">
          {face === 'thread' ? (
            <AnimatedPath animatedProps={thread} stroke={colors.background} strokeWidth={THREAD} strokeLinecap="round" fill="none" />
          ) : null}
          <AnimatedRect animatedProps={left} fill={colors.background} />
          <AnimatedRect animatedProps={right} fill={colors.background} />
          {voice ? <AnimatedRect animatedProps={mouth} fill={colors.background} /> : null}
        </G>
      </Svg>
    </Animated.View>
  );
}

const ring = {
  position: 'absolute',
  top: '-6%',
  left: '-6%',
  right: '-6%',
  bottom: '-6%',
  borderRadius: 9999,
  borderWidth: 3,
  borderColor: colors.accent,
  opacity: 0,
  animationName: {
    '0%': { transform: [{ scale: 1 }], opacity: 0.7 },
    '100%': { transform: [{ scale: 1.22 }], opacity: 0 },
  },
  animationDuration: '1.6s',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-out',
} as const;
