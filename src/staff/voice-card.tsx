import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { voiceSample } from './data';
import { BotMark } from './icons';
import { staffColors, staffFont } from './theme';

const MIN = 0.7;
const MAX = 1.2;
const clamp = (v: number) => Math.round(Math.min(MAX, Math.max(MIN, v)) * 10) / 10;

/**
 * "Listen to Hilo", as in the New person frame: a sample sentence in her language, at the speed staff choose,
 * in the same voice as her talks (voice-sample function). The speed is saved with her.
 */
export function VoiceCard({
  locale,
  name,
  speed,
  onSpeed,
}: {
  locale: string;
  name: string;
  speed: number;
  onSpeed: (v: number) => void;
}) {
  const [line, setLine] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'failed'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  // Bumped by stop(): a sample still loading when Stop is tapped must not start playing after
  const run = useRef(0);

  const stop = () => {
    run.current += 1;
    audio.current?.pause();
    audio.current = null;
    setState('idle');
  };

  // A new language, name or speed: the next "Listen" says it with the new one
  useEffect(() => stop, [locale, name, speed]);

  const play = async () => {
    if (state === 'playing' || state === 'loading') return stop();
    setState('loading');
    const mine = ++run.current;
    const sample = await voiceSample(locale, speed, name);
    if (mine !== run.current) return;
    if (!sample) return setState('failed');
    setLine(sample.text);
    // Web only (the staff pages never run on the phone)
    const a = new Audio(`data:audio/mpeg;base64,${sample.audio}`);
    a.onended = () => setState('idle');
    audio.current = a;
    try {
      await a.play();
      setState('playing');
    } catch {
      setState('failed');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card} accessibilityLabel="Try the voice">
        <Text style={styles.line}>{line ?? 'Hear how Hilo will talk to her and adjust the speed.'}</Text>
        <View style={styles.botBox}>
          {state === 'playing' ? (
            <>
              <Ring delay={0} />
              <Ring delay={800} />
            </>
          ) : null}
          <BotMark size={170} light />
        </View>
        <Pressable onPress={play} style={styles.listen} accessibilityRole="button">
          <Text style={styles.listenText}>
            {state === 'loading' ? 'Loading…' : state === 'playing' ? 'Stop' : 'Listen to Hilo'}
          </Text>
        </Pressable>
      </View>
      <View style={styles.speedRow}>
        <Pressable
          onPress={() => onSpeed(clamp(speed + 0.1))}
          disabled={speed >= MAX}
          style={[styles.round, speed >= MAX && styles.off]}
          accessibilityRole="button"
          accessibilityLabel="Faster">
          <Text style={styles.roundText}>+</Text>
        </Pressable>
        <View style={styles.speed}>
          <Text style={styles.speedText}>{`Speed ×${speed.toFixed(1)}`}</Text>
        </View>
        <Pressable
          onPress={() => onSpeed(clamp(speed - 0.1))}
          disabled={speed <= MIN}
          style={[styles.round, speed <= MIN && styles.off]}
          accessibilityRole="button"
          accessibilityLabel="Slower">
          <Text style={styles.roundText}>−</Text>
        </Pressable>
      </View>
      <Text style={state === 'failed' ? styles.error : styles.note}>
        {state === 'failed'
          ? "The voice didn't load. Try again."
          : 'A sample sentence, not a real talk. Speed goes from 0.7 to 1.2.'}
      </Text>
    </View>
  );
}

/** One ring growing out of the bot while Hilo speaks (the frame's hiloRing animation) */
function Ring({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - t.value), transform: [{ scale: 1 + 0.4 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[styles.ring, style]} />;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: {
    backgroundColor: staffColors.ink,
    borderRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 24,
  },
  line: {
    fontFamily: staffFont,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 23,
    color: '#fff',
    textAlign: 'center',
    maxWidth: 260,
    minHeight: 46,
  },
  botBox: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 99, borderWidth: 2, borderColor: '#fff' },
  listen: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: staffColors.ink },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.35 },
  roundText: { fontFamily: staffFont, fontSize: 24, color: '#fff' },
  speed: {
    flex: 1,
    minHeight: 52,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff', fontVariant: ['tabular-nums'] },
  note: { fontFamily: staffFont, fontSize: 13, color: staffColors.muted, textAlign: 'center' },
  error: { fontFamily: staffFont, fontSize: 13, color: staffColors.error, textAlign: 'center' },
});
