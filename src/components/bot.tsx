import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from 'react-native-reanimated';

import { colors } from '@/theme';

const sources = {
  right: require('../../assets/icons/bot.svg'),
  left: require('../../assets/icons/bot-looking-left.svg'),
};

export type BotMood = 'idle' | 'listening' | 'thinking' | 'speaking';

type Props = {
  size: number;
  mood?: BotMood;
  /** Which way the eyes look (Figma: Home looks right, Speech looks left) */
  look?: 'right' | 'left';
};

// Same motion as the approved HTML prototype
const float: CSSAnimationKeyframes = {
  '0%': { transform: [{ translateY: 0 }] },
  '50%': { transform: [{ translateY: -8 }] },
  '100%': { transform: [{ translateY: 0 }] },
};
const breathe: CSSAnimationKeyframes = {
  '0%': { transform: [{ scale: 1 }] },
  '50%': { transform: [{ scale: 1.025 }] },
  '100%': { transform: [{ scale: 1 }] },
};
const talk: CSSAnimationKeyframes = {
  '0%': { transform: [{ scale: 1 }] },
  '14%': { transform: [{ scale: 1.04 }] },
  '28%': { transform: [{ scale: 1.01 }] },
  '44%': { transform: [{ scale: 1.05 }] },
  '60%': { transform: [{ scale: 1.015 }] },
  '78%': { transform: [{ scale: 1.035 }] },
  '100%': { transform: [{ scale: 1 }] },
};
/** Idle: now and then it tilts as if looking around */
const peek: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '0deg' }] },
  '40%': { transform: [{ rotate: '0deg' }] },
  '46%': { transform: [{ rotate: '-7deg' }] },
  '62%': { transform: [{ rotate: '-7deg' }] },
  '68%': { transform: [{ rotate: '0deg' }] },
  '100%': { transform: [{ rotate: '0deg' }] },
};
const think: CSSAnimationKeyframes = {
  '0%': { transform: [{ rotate: '-4deg' }] },
  '50%': { transform: [{ rotate: '4deg' }] },
  '100%': { transform: [{ rotate: '-4deg' }] },
};
const ripple: CSSAnimationKeyframes = {
  '0%': { transform: [{ scale: 1 }], opacity: 0.7 },
  '100%': { transform: [{ scale: 1.22 }], opacity: 0 },
};

const loop = { animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' } as const;

export function Bot({ size, mood = 'idle', look = 'right' }: Props) {
  const reduceMotion = useReducedMotion();
  const anim = (style: object) => (reduceMotion ? null : style);

  const floatDuration = { idle: '5s', listening: '3s', thinking: '6s', speaking: '4s' }[mood];
  const scaleAnim =
    mood === 'speaking'
      ? { animationName: talk, animationDuration: '1.1s', ...loop }
      : mood === 'listening'
        ? null
        : { animationName: breathe, animationDuration: mood === 'thinking' ? '2.4s' : '4s', ...loop };
  const rotateAnim =
    mood === 'idle'
      ? { animationName: peek, animationDuration: '11s', ...loop }
      : mood === 'thinking'
        ? { animationName: think, animationDuration: '2.4s', ...loop }
        : null;

  return (
    <Animated.View style={[{ width: size, height: size }, anim({ animationName: float, animationDuration: floatDuration, ...loop })]}>
      {mood === 'listening' && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { animationName: ripple, animationDuration: '1.6s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-out' },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.fill, mood === 'listening' && styles.listening, anim(scaleAnim ?? {})]}>
        <Animated.View style={[styles.fill, anim(rotateAnim ?? {})]}>
          <Image source={sources[look]} style={styles.fill} contentFit="contain" accessibilityLabel="Tu asistente" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  listening: {
    transform: [{ scale: 1.04 }],
  },
  ring: {
    position: 'absolute',
    top: '-6%',
    left: '-6%',
    right: '-6%',
    bottom: '-6%',
    borderRadius: 9999,
    borderWidth: 3,
    borderColor: colors.sage,
    opacity: 0,
  },
});
