import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import { LiveBot } from '@/components/live-bot';
import { PressScale } from '@/components/press-scale';
import { t } from '@/i18n';
import { chapterAudio } from '@/lib/talk';
import { colors, fontWeight } from '@/theme';

const text = t.review;
const BARS = 34;
// A fixed, natural-looking waveform (the audio has no levels to read)
const HEIGHTS = Array.from({ length: BARS }, (_, i) => 0.2 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
/** The pause the server puts between paragraphs, as letters of speech (~15 a second) */
const PAUSE_CHARS = 14;

export type StoryPlayerHandle = { seekToParagraph: (i: number) => void };

type Props = {
  chapterId: string;
  title: string;
  paragraphs: string[];
  /** The paragraph being read (null for the title, or when stopped) */
  onParagraph: (i: number | null) => void;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Frame "9 · A story": Hilo reads her story aloud, with the voice and speed she hears it in. A black pill at the
 * bottom: the Bot (its mouth moves while it reads), the waveform filling up, and the time. Tap to play or pause.
 * The paragraph being read is worked out from the length of each one (the recording is one file).
 */
export const StoryPlayer = forwardRef<StoryPlayerHandle, Props>(function StoryPlayer({ chapterId, title, paragraphs, onParagraph }, ref) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const mouth = useSharedValue(0);

  // Where each part starts, as a share of the recording: the title, then each paragraph
  const lengths = [title, ...paragraphs].map((p) => p.length + PAUSE_CHARS);
  const total = lengths.reduce((a, b) => a + b, 0);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0) / total);

  const duration = status.duration || 0;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;
  const ended = status.didJustFinish || (duration > 0 && status.currentTime >= duration - 0.4);
  const playing = state === 'ready' && status.playing;

  // The paragraph being read
  const part = starts.findLastIndex((s) => s <= progress);
  const reading = playing || (state === 'ready' && progress > 0 && !ended) ? (part <= 0 ? null : part - 1) : null;
  useEffect(() => {
    onParagraph(reading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  // The mouth moves with the voice while it reads
  useEffect(() => {
    if (!playing) {
      mouth.set(withTiming(0, { duration: 160 }));
      return;
    }
    const id = setInterval(() => mouth.set(withTiming(0.15 + Math.random() * 0.75, { duration: 120 })), 140);
    return () => clearInterval(id);
  }, [playing, mouth]);

  const load = async () => {
    setState('loading');
    const url = await chapterAudio(chapterId);
    if (!url) return setState('failed');
    // Out loud even with the iPhone on silent
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' });
    player.replace({ uri: url });
    setState('ready');
    return true;
  };

  const press = async () => {
    if (state === 'loading') return;
    if (state !== 'ready') {
      if (await load()) player.play();
      return;
    }
    if (status.playing) return player.pause();
    if (ended) await player.seekTo(0);
    player.play();
  };

  useImperativeHandle(ref, () => ({
    seekToParagraph: async (i: number) => {
      if (state !== 'ready' && !(await load())) return;
      const d = player.duration || duration;
      if (d) await player.seekTo(starts[i + 1] * d + 0.05);
      player.play();
    },
  }));

  const label = state === 'loading' ? text.listenPreparing : state === 'failed' ? text.listenFailed : playing ? text.listenPause : text.listen;

  return (
    <PressScale onPress={press} accessibilityRole="button" accessibilityLabel={label} style={styles.pill}>
      <View style={styles.bot}>
        {state === 'loading' ? <ActivityIndicator color={colors.ink} /> : <LiveBot size={34} voice={mouth} />}
      </View>
      {state === 'failed' ? (
        <Text style={styles.failed} numberOfLines={1}>
          {text.listenFailed}
        </Text>
      ) : (
        <View style={styles.wave}>
          {HEIGHTS.map((h, i) => (
            <View key={i} style={[styles.bar, { height: `${h * 100}%` }, i / BARS < progress ? styles.barOn : null]} />
          ))}
        </View>
      )}
      <Text style={styles.time}>{state === 'ready' && duration ? clock(playing || progress ? status.currentTime : duration) : '▶'}</Text>
    </PressScale>
  );
});

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 20, borderRadius: 40, backgroundColor: colors.ink },
  bot: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.onAccent },
  wave: { flex: 1, height: 32, flexDirection: 'row', alignItems: 'center', gap: 3 },
  bar: { flex: 1, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  barOn: { backgroundColor: colors.onAccent },
  time: { minWidth: 36, textAlign: 'right', fontSize: 15, fontWeight: fontWeight.bold, color: colors.onAccent, fontVariant: ['tabular-nums'] },
  failed: { flex: 1, fontSize: 14, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.7)' },
});
