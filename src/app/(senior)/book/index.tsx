import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { loadBook } from '@/lib/book';
import { useWide } from '@/lib/layout';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const text = t.book;

export default function BookScreen() {
  const fade = useScrollFade();
  const { width, height } = useWindowDimensions();
  // iPad on its side: her book big on the left instead of the bot, the chapters on the right
  const wide = useWide();
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(null);

  // Again each time she comes back: the family may have approved a new story
  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  const chapters = book && 'chapters' in book ? book.chapters : [];
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
          <ScreenHeader
            backLabel={text.back}
            title={text.title}
            subtitle={book && 'chapters' in book ? text.count(chapters.length) : undefined}
          />

          {book && 'name' in book && !wide ? (
            <View style={styles.cover}>
              <BookCover width={Math.min(220, width * 0.55)} title={text.cover(book.name)} />
            </View>
          ) : null}

          {book && 'error' in book ? <Text style={styles.note}>{book.error}</Text> : null}
          {book && 'chapters' in book && !chapters.length ? <Text style={styles.note}>{text.empty}</Text> : null}

          <View style={styles.list}>
            {chapters.map((chapter) => (
              <PressScale
                key={chapter.id}
                onPress={() => router.push({ pathname: '/book/[chapter]', params: { chapter: chapter.id } })}
                accessibilityRole="button"
                accessibilityLabel={text.chapterA11y(chapter.number, chapter.title)}
                style={styles.chapter}>
                <View style={styles.chapterText}>
                  <Text style={styles.kicker}>{text.kicker(chapter.number)}</Text>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </PressScale>
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
    marginTop: 36,
  },
  list: {
    marginTop: 48,
    gap: spacing.buttonGap,
  },
  chapter: {
    minHeight: 84,
    borderWidth: size.buttonBorder,
    borderColor: colors.sage,
    borderRadius: 42,
    paddingVertical: 12,
    paddingLeft: 26,
    paddingRight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.background,
  },
  chapterText: {
    flexShrink: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.muted,
  },
  chapterTitle: {
    fontSize: fontSize.pillName,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  chevron: {
    fontSize: 30,
    fontWeight: fontWeight.semibold,
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
