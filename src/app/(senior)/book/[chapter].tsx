import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SideCover } from '@/components/book-cover';
import { BotFace } from '@/components/icons';
import { ListenButton } from '@/components/listen-button';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { cachedBook, loadBook } from '@/lib/book';
import { colors, fontSize, fontWeight, serif, spacing } from '@/theme';

const text = t.chapter;

export default function ChapterScreen() {
  const { chapter: id } = useLocalSearchParams<{ chapter: string }>();
  const fade = useScrollFade();
  // Opens with the book Mi libro already has, so the page is never blank while it slides in
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(cachedBook);
  // "Aa": bigger letters for this reading, on top of the system text size
  const [big, setBig] = useState(false);

  useEffect(() => {
    loadBook().then(setBook);
  }, []);

  const page = <Stack.Screen options={{ contentStyle: { backgroundColor: colors.background } }} />;

  const back = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel={text.backLabel}
      hitSlop={8}
      style={styles.back}>
      <Text style={styles.backText}>{text.back}</Text>
    </Pressable>
  );

  const chapters = book && 'chapters' in book ? book.chapters : [];
  const index = chapters.findIndex((c) => c.id === id);
  const chapter = chapters[index];
  // Loading, no connection, or a story the family took back: never a page without a way out
  if (!book || 'error' in book || !chapter) {
    return (
      <SafeAreaView style={styles.safe}>
        {page}
        <View style={styles.screen}>
          <View style={styles.top}>{back}</View>
          {book && 'error' in book ? <Text style={styles.paragraph}>{book.error}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }
  const next = chapters[index + 1];

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
      {page}
      <WideFrame side={<SideCover name={book.name} />}>
        <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
          <View style={styles.top}>
            {back}
            <Pressable
              onPress={() => setBig((b) => !b)}
              accessibilityRole="button"
              accessibilityLabel={big ? text.normal : text.bigger}
              hitSlop={8}
              style={[styles.aa, big && styles.aaOn]}>
              <Text style={[styles.aaText, big && styles.aaTextOn]}>Aa</Text>
            </Pressable>
          </View>

          {/* The chapter's cover (Figma "Hilo book chapter"): the bot on black, the title on a white card */}
          <View accessibilityRole="header" accessibilityLabel={`${text.kicker(chapter.number)}. ${chapter.title}`} style={styles.cover}>
            <View style={styles.coverBot}>
              <BotFace size={270} />
            </View>
            {/* Her face fades into the dark above the title, like in the Figma */}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} style={styles.coverShade} pointerEvents="none" />
            <View style={styles.coverCard}>
              <Text style={styles.title}>{chapter.title}</Text>
              <Text style={styles.number}>{String(chapter.number).padStart(2, '0')}</Text>
            </View>
          </View>

          {/* key: a new player for each chapter when she goes to the next one */}
          <ListenButton key={chapter.id} chapterId={chapter.id} />

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
                  onPress={() =>
                    router.replace({
                      pathname: '/book/[chapter]',
                      params: { chapter: next.id },
                    })
                  }
                  accessibilityRole="button"
                  hitSlop={8}>
                  <Text style={styles.nextLink}>{next.title} ›</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>
      </WideFrame>
      <ScrollFade visible={fade.visible} color={colors.background} />
    </SafeAreaView>
  );
}

// Book typography (serif on a white page, as in the Figma) only here: reading a chapter should feel like reading a book
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
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
  cover: {
    height: 430,
    marginBottom: 24,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.ink,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  coverBot: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
  },
  coverShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 130,
    height: 130,
  },
  // The white card over the bottom of the cover, with the title and the chapter number
  coverCard: {
    position: 'absolute',
    left: -3,
    right: -3,
    bottom: -3,
    minHeight: 186,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.4,
    textAlign: 'center',
    color: colors.ink,
  },
  number: {
    fontSize: 30,
    fontWeight: '300',
    color: colors.ink,
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
