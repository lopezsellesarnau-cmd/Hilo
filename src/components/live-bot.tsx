import { useEffect, useId, useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent } from 'react-native';
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
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { colors } from '@/theme';

/**
 * Hilo's bot, alive: the StackD Bot (hexagon, tall eyes), like the app icon
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

/** On the web: the mouse, one listener for every bot on the page (like the StackD Bot). */
let mouse: Finger | null = null;
function webMouse(): Finger {
  if (mouse) return mouse;
  const fns = new Set<(p: Point, start: boolean) => void>();
  const send = (p: Point) => fns.forEach((fn) => fn(p, false));
  window.addEventListener('pointermove', (e) => send({ x: e.clientX, y: e.clientY }), { passive: true });
  // Out of the window: back to rest
  document.documentElement.addEventListener('pointerleave', () => send(null));
  mouse = {
    listen: (fn) => {
      fns.add(fn);
      return () => {
        fns.delete(fn);
      };
    },
  };
  return mouse;
}

type Props = {
  size: number;
  mood?: BotMood;
  /** Which way it looks at rest. */
  look?: 'right' | 'left';
  finger?: Finger;
  /** On the web, follow the mouse anywhere on the page (no `finger` needed). */
  cursor?: boolean;
  /** How loud Hilo's voice is right now, 0 to 1: the mouth opens with it (like the StackD voice memo). */
  voice?: SharedValue<number>;
  /** 'stackd': tall capsule eyes like the StackD Bot, a bit bigger (default). 'thread': Hilo's round eyes joined by a thread. */
  face?: Face;
  /** The body, from the StackD Bot: hexagon by default, like the app icon (the book gives each chapter its own). The thread face is circle only. */
  shape?: BotShape;
  /** Body and eye colours (default: black body, white eyes). */
  color?: string;
  eyeColor?: string;
};

type Face = 'stackd' | 'thread';

/* The StackD Bot's bodies, in a 100-unit box. cx/cy is where the face rests, rx/ry how far the eyes travel. */
const SHAPES = {
  circle: { d: 'M50 0a50 50 0 1 1 0 100a50 50 0 1 1 0-100Z', cx: 50, cy: 50, rx: 50, ry: 50 },
  squircle: { d: 'M36 4h28c18 0 32 14 32 32v28c0 18-14 32-32 32H36C18 96 4 82 4 64V36C4 18 18 4 36 4Z', cx: 50, cy: 50, rx: 46, ry: 46 },
  pill: { d: 'M36 18h28a32 32 0 0 1 0 64H36a32 32 0 0 1 0-64Z', cx: 50, cy: 50, rx: 46, ry: 32 },
  arch: { d: 'M50 6c22 0 40 18 40 40v40c0 5.5-4.5 10-10 10H20c-5.5 0-10-4.5-10-10V46C10 24 28 6 50 6Z', cx: 50, cy: 52, rx: 40, ry: 44 },
  drop: { d: 'M44 8c3-4 9-4 12 0C66 20 86 42 86 62a36 36 0 0 1-72 0C14 42 34 20 44 8Z', cx: 50, cy: 62, rx: 34, ry: 30 },
  triangle: { d: 'M62 25.1L86 70.9Q98 94 72 94H28Q2 94 14 70.9L38 25.1Q50 2 62 25.1Z', cx: 50, cy: 66, rx: 30, ry: 22 },
  cloud: { d: 'M6 58a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM24 40a28 28 0 1 0 56 0a28 28 0 1 0-56 0ZM52 56a22 22 0 1 0 44 0a22 22 0 1 0-44 0ZM24 70a22 22 0 1 0 44 0a22 22 0 1 0-44 0ZM52 72a18 18 0 1 0 36 0a18 18 0 1 0-36 0Z', cx: 50, cy: 58, rx: 40, ry: 30 },
  clover: { d: 'M8 32a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM44 32a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM8 68a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM44 68a24 24 0 1 0 48 0a24 24 0 1 0-48 0ZM16 50a34 34 0 1 0 68 0a34 34 0 1 0-68 0Z', cx: 50, cy: 50, rx: 40, ry: 40 },
  hexagon: { d: 'M85.9 70.4L70.4 85.9Q61.9 94.4 50.3 91.3L29.1 85.6Q17.5 82.5 14.4 70.9L8.7 49.7Q5.6 38.1 14.1 29.6L29.6 14.1Q38.1 5.6 49.7 8.7L70.9 14.4Q82.5 17.5 85.6 29.1L91.3 50.3Q94.4 61.9 85.9 70.4Z', cx: 50, cy: 50, rx: 40, ry: 40 },
};
export type BotShape = keyof typeof SHAPES;
export const BOT_SHAPES = Object.keys(SHAPES) as BotShape[];
type Body = (typeof SHAPES)[BotShape];

/** Where the face sits and how far it travels: the shape's for StackD eyes, the old fixed one for the thread. */
function frame(face: Face, body: Body) {
  'worklet';
  return face === 'thread' ? { cx: 50, cy: 50, rx: 44, ry: 44 } : body;
}

// In a 100-unit box. w/h: eye size facing straight on; spacing: from the centre to each eye.
const FACES = {
  // The StackD Bot's tall eyes (11 × 21, 13 from the centre), as on the app icon. A diagonal look leans them.
  stackd: { w: 11, h: 21, spacing: 13, tilt: true },
  // Measured from the 18 oct bot (the first logo): round eyes, radius 11.5
  thread: { w: 23, h: 23, spacing: 24.6, tilt: false },
};
const THREAD = 3.1; // thread width
const MOUTH = 1; // the StackD mouth (12-20 wide, 2.5-11.5 tall), at the same scale as the eyes
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
function eye(face: Face, body: Body, side: number, x: number, y: number, blink: number) {
  'worklet';
  const clamp = (v: number) => Math.min(0.92, Math.max(-0.92, v));
  const yaw = Math.asin(clamp(x));
  const pitch = -Math.asin(clamp(y));
  const f = FACES[face];
  const b = frame(face, body);
  const x0 = side * (f.spacing / b.rx);
  const z0 = Math.sqrt(1 - x0 * x0);
  const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
  const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
  const y2 = -z1 * Math.sin(pitch);
  const near = Math.min(1, Math.max(0, z1 * Math.cos(pitch)));
  const k = 0.45 + 0.55 * near;
  const cx = b.cx + x1 * b.rx;
  const cy = b.cy + y2 * b.ry;
  const w = f.w * k * (0.7 + 0.3 * near);
  const h = f.h * k * blink;
  // StackD: a diagonal look leans the pair, 60° × x × y
  const tilt = f.tilt ? (60 * x * y * Math.PI) / 180 : 0;
  return { cx, cy, w, h, tilt };
}

/** An eye as a capsule turned by its tilt (an SVG rect can't be rotated from an animation). */
function capsule(cx: number, cy: number, w: number, h: number, tilt: number) {
  'worklet';
  const c = Math.cos(tilt);
  const s = Math.sin(tilt);
  // The long axis and the side it bulges to, turned by the tilt; a blink makes it wider than tall
  const tall = h >= w;
  const r = Math.max(0.01, (tall ? w : h) / 2);
  const half = Math.max(0, (tall ? h : w) / 2 - r);
  const [ax, ay] = tall ? [-s, c] : [c, s];
  const [sx, sy] = tall ? [c, s] : [s, -c];
  const p = (along: number, side: number) => `${cx + ax * along + sx * side} ${cy + ay * along + sy * side}`;
  return `M${p(-half, r)}L${p(half, r)}A${r} ${r} 0 0 1 ${p(half, -r)}L${p(-half, -r)}A${r} ${r} 0 0 1 ${p(-half, r)}Z`;
}

/** The mouth: a point on the sphere below the eyes, turned with the head like they are (StackD Bot maths). */
function mouthBox(face: Face, body: Body, x: number, y: number, open: number) {
  'worklet';
  const clamp = (v: number) => Math.min(0.92, Math.max(-0.92, v));
  const yaw = Math.asin(clamp(x));
  const pitch = -Math.asin(clamp(y));
  const b = frame(face, body);
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
  const cx = b.cx + x1 * b.rx;
  const cy = b.cy + y2 * b.ry;
  return { x: cx - w / 2, y: cy - h / 2, width: w, height: h, rx: Math.min(w, h) / 2 };
}

export function LiveBot({
  size,
  mood = 'idle',
  look = 'right',
  finger,
  face = 'stackd',
  voice,
  cursor = false,
  shape = 'hexagon',
  color = colors.ink,
  eyeColor = colors.background,
}: Props) {
  const body = SHAPES[face === 'thread' ? 'circle' : shape];
  // One clip per bot: several shapes can share a screen (the chapters of the book)
  const clip = `bot-${useId().replace(/:/g, '')}`;
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

  // Follow the finger (or the mouse on the web), only while idle (in a talk the mood decides where it looks)
  const web = cursor && Platform.OS === 'web';
  useEffect(() => {
    const source = finger ?? (web ? webMouse() : null);
    if (!source || mood !== 'idle') return;
    let measured = 0;
    const go = (v: number) => (reduceMotion ? withTiming(v, { duration: 0 }) : withSpring(v, SPRING));
    let back: ReturnType<typeof setTimeout> | undefined;
    const stop = source.listen((p, start) => {
      if (back) clearTimeout(back);
      if (!p) {
        back = setTimeout(() => {
          lookX.value = go(target.x);
          lookY.value = go(target.y);
        }, BACK);
        return;
      }
      // The screen may have scrolled since the last touch (the mouse never "starts": every quarter second)
      if (start || (web && Date.now() - measured > 250)) {
        measure();
        measured = Date.now();
      }
      const c = centre.current;
      // Within about one and a half bots of distance the look is already full; further away it saturates.
      // Small avatars on the web use a wider reach, or they would all stare at once.
      const reach = web ? Math.max(size * 1.6, 260) : size * 1.6;
      const dx = (p.x - c.x) / reach;
      const dy = (p.y - c.y) / reach;
      const d = Math.hypot(dx, dy);
      const s = d > 1 ? 1 / d : 1;
      lookX.value = go(dx * s * FOLLOW);
      lookY.value = go(dy * s * FOLLOW);
    });
    return () => {
      if (back) clearTimeout(back);
      stop();
    };
  }, [finger, web, mood, size, target.x, target.y, reduceMotion, lookX, lookY]);

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
    const e = eye(face, body, -1, lookX.value, lookY.value, blink.value);
    return { d: capsule(e.cx, e.cy, e.w, e.h, e.tilt) };
  });
  const right = useAnimatedProps(() => {
    const e = eye(face, body, 1, lookX.value, lookY.value, blink.value);
    return { d: capsule(e.cx, e.cy, e.w, e.h, e.tilt) };
  });
  // The thread runs from eye to eye and hangs a little, like the logo
  const thread = useAnimatedProps(() => {
    const a = eye(face, body, -1, lookX.value, lookY.value, 1);
    const b = eye(face, body, 1, lookX.value, lookY.value, 1);
    const sag = Math.hypot(b.cx - a.cx, b.cy - a.cy) * SAG;
    const mx = (a.cx + b.cx) / 2;
    const my = (a.cy + b.cy) / 2 + sag;
    return { d: `M${a.cx} ${a.cy}Q${mx} ${my} ${b.cx} ${b.cy}` };
  });
  // Only while speaking: if the audio stops without saying so, the mouth still closes
  const speaking = mood === 'speaking';
  const mouth = useAnimatedProps(() => mouthBox(face, body, lookX.value, lookY.value, voice && speaking ? voice.value : 0));
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
          <ClipPath id={clip}>
            <Path d={body.d} />
          </ClipPath>
        </Defs>
        <Path d={body.d} fill={color} />
        <G clipPath={`url(#${clip})`}>
          {face === 'thread' ? (
            <AnimatedPath animatedProps={thread} stroke={eyeColor} strokeWidth={THREAD} strokeLinecap="round" fill="none" />
          ) : null}
          <AnimatedPath animatedProps={left} fill={eyeColor} />
          <AnimatedPath animatedProps={right} fill={eyeColor} />
          {voice ? <AnimatedRect animatedProps={mouth} fill={eyeColor} /> : null}
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
