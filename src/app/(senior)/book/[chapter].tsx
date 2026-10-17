import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { loadBook } from '@/lib/book';
import { colors, fontSize, fontWeight, serif, spacing } from '@/theme';

const text = t.chapter;

export default function ChapterScreen() {
  const { chapter: id } = useLocalSearchParams<{ chapter: string }>();
  const fade = useScrollFade();
  const { width, height } = useWindowDimensions();
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(null);
  // "Aa": bigger letters for this reading, on top of the system text size
  const [big, setBig] = useState(false);

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

  // iPad on its side: her book on the left, like in Mi libro (282 tall for 230 wide)
  const cover = <BookCover width={Math.min(300, width * 0.25, (height * 0.6 * 230) / 282)} title={text.cover(book.name)} />;

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
      <WideFrame side={cover}>
        <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
          <View style={styles.top}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={text.backLabel}
              hitSlop={8}
              style={styles.back}>
              <Text style={styles.backText}>{text.back}</Text>
            </Pressable>
            <Pressable
              onPress={() => setBig((b) => !b)}
              accessibilityRole="button"
              accessibilityLabel={big ? text.normal : text.bigger}
              hitSlop={8}
              style={[styles.aa, big && styles.aaOn]}>
              <Text style={[styles.aaText, big && styles.aaTextOn]}>Aa</Text>
            </Pressable>
          </View>

          <View accessibilityRole="header" style={styles.header}>
            <Text style={styles.kicker}>{text.kicker(chapter.number)}</Text>
            <Text style={styles.title}>{chapter.title}</Text>
            <View style={styles.rule} />
            <Text style={styles.by}>{text.by(book.name)}</Text>
          </View>

          {first ? (
            // Hanging initial: React Native can't wrap text around a dropped letter,
            // so the large letter sits on the left and the paragraph runs beside it
            <View style={styles.firstRow} accessible accessibilityLabel={first}>
              <Text style={styles.initial}>{first.charAt(0)}</Text>
              <Text style={[styles.paragraph, big && styles.paragraphBig, styles.firstText]}>{first.slice(1)}</Text>
            </View>
          ) : null}
          {rest.map((p, i) => (
            <View key={i}>
              {i === quoteAt ? quote : null}
              <Text style={[styles.paragraph, big && styles.paragraphBig]}>{p}</Text>
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
      </WideFrame>
      <ScrollFade visible={fade.visible} color={colors.paper} />
    </SafeAreaView>
  );
}

// Book typography (serif on paper) only here: reading a chapter should feel like reading a book
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenX + 6,
    paddingTop: spacing.screenTop,
    paddingBottom: 72,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  back: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  backText: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  aa: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aaOn: {
    backgroundColor: colors.accent,
  },
  aaText: {
    fontFamily: serif,
    fontSize: 22,
    color: colors.ink,
  },
  aaTextOn: {
    color: colors.onAccent,
  },
  header: {
    alignItems: 'center',
  },
  kicker: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    color: '#6b6457',
    marginBottom: 10,
  },
  title: {
    fontFamily: serif,
    fontSize: 36,
    lineHeight: 40,
    color: colors.ink,
    textAlign: 'center',
  },
  rule: {
    width: 40,
    height: 1,
    marginTop: 18,
    backgroundColor: colors.ink,
  },
  by: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 20,
    lineHeight: 28,
    color: '#4a453c',
    marginTop: 14,
  },
  paragraph: {
    fontFamily: serif,
    fontSize: 22,
    lineHeight: 34,
    color: '#1a1a1a',
    marginTop: 18,
  },
  paragraphBig: {
    fontSize: 27,
    lineHeight: 41,
  },
  firstRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 26,
  },
  initial: {
    fontFamily: serif,
    fontSize: 66,
    lineHeight: 70,
    color: colors.ink,
    marginTop: -4,
  },
  firstText: {
    flex: 1,
    marginTop: 0,
  },
  quote: {
    marginTop: 34,
    marginBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quoteMark: {
    fontFamily: serif,
    fontSize: 64,
    lineHeight: 60,
    height: 36,
    color: colors.ink,
  },
  quoteText: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 27,
    lineHeight: 35,
    color: colors.ink,
    textAlign: 'center',
  },
  end: {
    alignItems: 'center',
    gap: 14,
    marginTop: 44,
  },
  dot: {
    width: 40,
    height: 1,
    backgroundColor: colors.ink,
  },
  nextLabel: {
    fontSize: fontSize.talk,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
  nextLink: {
    fontFamily: serif,
    fontSize: 24,
    color: colors.ink,
    textDecorationLine: 'underline',
    textDecorationColor: colors.ink,
  },
});
