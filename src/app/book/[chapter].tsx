import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { sampleChapters } from '@/data/sample';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Simulated length until real audio exists */
const LISTEN_SECONDS = 40;

export default function ChapterScreen() {
  const { chapter: param } = useLocalSearchParams<{ chapter: string }>();
  const chapter = sampleChapters.find((c) => String(c.number) === param) ?? sampleChapters[0];
  const next = sampleChapters.find((c) => c.number === chapter.number + 1);
  const fade = useScrollFade();

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
    setElapsed(0);
  };
  const toggle = () => {
    if (playing) return stop();
    setPlaying(true);
    let seconds = 0;
    timer.current = setInterval(() => {
      seconds += 1;
      if (seconds >= LISTEN_SECONDS) stop();
      else setElapsed(seconds);
    }, 1000);
  };
  // Stop the sound when leaving or switching chapter
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [chapter.number],
  );

  const [first, ...rest] = chapter.paragraphs;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver a Mi libro"
          hitSlop={12}
          style={styles.back}>
          <Text style={styles.backText}>‹ Mi libro</Text>
        </Pressable>

        <View accessibilityRole="header" style={styles.header}>
          <Text style={styles.kicker}>CAPÍTULO {chapter.number}</Text>
          <Text style={styles.title}>{chapter.title}</Text>
          <Text style={styles.by}>Contado por Carmen</Text>
        </View>

        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Parar' : 'Escuchar mi historia'}
          style={({ pressed }) => [styles.listen, playing && styles.listenOn, pressed && styles.pressed]}>
          <Text style={[styles.listenIcon, playing && styles.listenTextOn]}>{playing ? '❚❚' : '▶'}</Text>
          <Text style={[styles.listenText, playing && styles.listenTextOn]} numberOfLines={1}>
            {playing ? 'Escuchando · Parar' : 'Escuchar mi historia'}
          </Text>
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${(elapsed / LISTEN_SECONDS) * 100}%` }]} />
        </View>

        {first ? (
          <Text style={styles.paragraph}>
            {/* Raised initial: React Native can't wrap text around a dropped letter */}
            <Text style={styles.initial}>{first.charAt(0)}</Text>
            {first.slice(1)}
          </Text>
        ) : null}
        {rest.map((p, i) => (
          <View key={i}>
            {i === 1 && chapter.quote ? (
              <View style={styles.quote}>
                <Text style={styles.quoteMark}>“</Text>
                <Text style={styles.quoteText}>{chapter.quote}</Text>
              </View>
            ) : null}
            <Text style={styles.paragraph}>{p}</Text>
          </View>
        ))}

        <View style={styles.end}>
          <View style={styles.dot} />
          {next?.status === 'approved' ? (
            <>
              <Text style={styles.nextLabel}>Siguiente</Text>
              <Pressable
                onPress={() => router.replace({ pathname: '/book/[chapter]', params: { chapter: String(next.number) } })}
                accessibilityRole="button"
                hitSlop={8}>
                <Text style={styles.nextLink}>{next.title} ›</Text>
              </Pressable>
            </>
          ) : next ? (
            <Text style={styles.nextLabel}>
              Siguiente: {next.title}
              {'\n'}Lo estamos escribiendo contigo
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <ScrollFade visible={fade.visible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 72,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 14,
  },
  backText: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  header: {
    alignItems: 'center',
  },
  kicker: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.muted,
    marginBottom: 6,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  by: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    marginTop: 6,
  },
  listen: {
    marginTop: 26,
    minHeight: 76,
    borderRadius: 38,
    backgroundColor: colors.sage,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  listenOn: {
    backgroundColor: colors.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  listenIcon: {
    fontSize: 22,
    color: colors.ink,
  },
  listenText: {
    fontSize: fontSize.pillName,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  listenTextOn: {
    color: colors.background,
  },
  progress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sageSoft,
    marginTop: 12,
    marginHorizontal: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.ink,
  },
  paragraph: {
    fontSize: 24,
    lineHeight: 37,
    fontWeight: '500',
    color: colors.ink,
    marginTop: 22,
  },
  initial: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.sage,
  },
  quote: {
    marginTop: 38,
    marginBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quoteMark: {
    fontSize: 72,
    lineHeight: 64,
    height: 40,
    fontWeight: '700',
    color: colors.sage,
  },
  quoteText: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  end: {
    alignItems: 'center',
    gap: 14,
    marginTop: 44,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sage,
  },
  nextLabel: {
    fontSize: fontSize.talk,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
  nextLink: {
    fontSize: 22,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textDecorationLine: 'underline',
    textDecorationColor: colors.sage,
  },
});
