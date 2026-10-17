import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { ChevronCircle } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { cachedBook, loadBook } from '@/lib/book';
import { useWide } from '@/lib/layout';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

const text = t.book;

export default function BookScreen() {
  const fade = useScrollFade();
  const { width, height } = useWindowDimensions();
  // iPad on its side: her book big on the left instead of the bot, the chapters on the right
  const wide = useWide();
  // The book Home already loaded: no empty page while the screen comes in
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(cachedBook);

  // Again each time she comes back: the family may have approved a new story
  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  const chapters = book && 'chapters' in book ? book.chapters : [];
  const coverWidth = Math.min(164, width * 0.42, height * 0.2);
  // The book is 282 tall for 230 wide (Figma)
  const bigCover =
    book && 'name' in book ? (
      <BookCover width={Math.min(300, width * 0.25, (height * 0.6 * 230) / 282)} title={text.cover(book.name)} />
    ) : (
      <View />
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame side={bigCover}>
        <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
          <ScreenHeader backLabel={text.back} />

          {/* Her book first, then the title: the picture says what this screen is */}
          {/* The cover's space is kept while loading, so the title never jumps down */}
          {wide ? null : (
            <View style={[styles.cover, { height: (coverWidth * 250) / 200 }]}>
              {book && 'name' in book ? <BookCover width={coverWidth} title={text.cover(book.name)} /> : null}
            </View>
          )}
          <View accessibilityRole="header" style={styles.titles}>
            <Text style={styles.title}>{text.title}</Text>
            {book && 'chapters' in book ? <Text style={styles.subtitle}>{text.count(chapters.length)}</Text> : null}
          </View>

          {book && 'error' in book ? <Text style={styles.note}>{book.error}</Text> : null}
          {book && 'chapters' in book && !chapters.length ? <Text style={styles.note}>{text.empty}</Text> : null}

          <View style={styles.list}>
            {chapters.map((chapter, i) => (
              <Animated.View key={chapter.id} entering={FadeInDown.duration(400).delay(120 + Math.min(i, 6) * 70)}>
                <PressScale
                  onPress={() =>
                    router.push({
                      pathname: '/book/[chapter]',
                      params: { chapter: chapter.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={text.chapterA11y(chapter.number, chapter.title)}
                  style={styles.chapter}>
                  <View style={styles.chapterText}>
                    <Text style={styles.kicker}>{text.kicker(chapter.number)}</Text>
                    <Text style={styles.chapterTitle}>{chapter.title}</Text>
                  </View>
                  <ChevronCircle />
                </PressScale>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </WideFrame>
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
  cover: {
    alignItems: 'center',
  },
  titles: {
    marginTop: 18,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: fontWeight.regular,
    color: colors.muted,
  },
  list: {
    marginTop: 22,
    gap: 10,
  },
  // Grey pill per chapter, the round black arrow at the end
  chapter: {
    minHeight: 78,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 24,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.surface,
  },
  chapterText: {
    flexShrink: 1,
  },
  kicker: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  chapterTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  note: {
    marginTop: 40,
    fontSize: fontSize.talk,
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
});
