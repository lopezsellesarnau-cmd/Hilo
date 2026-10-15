import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { loadBook } from '@/lib/book';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

const text = {
  back: '‹ Mi libro',
  backLabel: 'Volver a Mi libro',
  kicker: (n: number) => `CAPÍTULO ${n}`,
  by: (name: string) => `Contado por ${name}`,
  next: 'Siguiente',
};

export default function ChapterScreen() {
  const { chapter: id } = useLocalSearchParams<{ chapter: string }>();
  const fade = useScrollFade();
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(null);

  useEffect(() => {
    loadBook().then(setBook);
  }, []);

  if (!book || 'error' in book) {
    return (
      <SafeAreaView style={styles.safe}>
        {book ? <Text style={[styles.paragraph, styles.screen]}>{book.error}</Text> : null}
      </SafeAreaView>
    );
  }
  const index = book.chapters.findIndex((c) => c.id === id);
  const chapter = book.chapters[index];
  if (!chapter) return <SafeAreaView style={styles.safe} />;
  const next = book.chapters[index + 1];

  const [first, ...rest] = chapter.paragraphs;
  // Her sentence goes in the middle of the story
  const quoteAt = Math.floor(rest.length / 2);
  const quote = chapter.quote ? (
    <View style={styles.quote}>
      <Text style={styles.quoteMark}>“</Text>
      {/* Her words are copied as she said them; only the first letter is capitalised */}
      <Text style={styles.quoteText}>{chapter.quote.charAt(0).toUpperCase() + chapter.quote.slice(1)}</Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={text.backLabel}
          hitSlop={12}
          style={styles.back}>
          <Text style={styles.backText}>{text.back}</Text>
        </Pressable>

        <View accessibilityRole="header" style={styles.header}>
          <Text style={styles.kicker}>{text.kicker(chapter.number)}</Text>
          <Text style={styles.title}>{chapter.title}</Text>
          <Text style={styles.by}>{text.by(book.name)}</Text>
        </View>

        {first ? (
          // Hanging initial: React Native can't wrap text around a dropped letter,
          // so the large letter sits on the left and the paragraph runs beside it
          <View style={styles.firstRow} accessible accessibilityLabel={first}>
            <Text style={styles.initial}>{first.charAt(0)}</Text>
            <Text style={[styles.paragraph, styles.firstText]}>{first.slice(1)}</Text>
          </View>
        ) : null}
        {rest.map((p, i) => (
          <View key={i}>
            {i === quoteAt ? quote : null}
            <Text style={styles.paragraph}>{p}</Text>
          </View>
        ))}
        {rest.length === 0 ? quote : null}

        <View style={styles.end}>
          <View style={styles.dot} />
          {next ? (
            <>
              <Text style={styles.nextLabel}>{text.next}</Text>
              <Pressable
                onPress={() => router.replace({ pathname: '/book/[chapter]', params: { chapter: next.id } })}
                accessibilityRole="button"
                hitSlop={8}>
                <Text style={styles.nextLink}>{next.title} ›</Text>
              </Pressable>
            </>
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
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
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
  paragraph: {
    fontSize: 24,
    lineHeight: 37,
    fontWeight: '500',
    color: colors.ink,
    marginTop: 22,
  },
  firstRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 22,
  },
  initial: {
    fontSize: 78,
    lineHeight: 82,
    fontWeight: '700',
    color: colors.sage,
    marginTop: -2,
  },
  firstText: {
    flex: 1,
    marginTop: 0,
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
