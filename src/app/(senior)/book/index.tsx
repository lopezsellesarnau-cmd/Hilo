import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SideCover } from '@/components/book-cover';
import { ChapterCard } from '@/components/chapter-card';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { cachedBook, loadBook } from '@/lib/book';
import { colors, fontSize, fontWeight, serif, spacing } from '@/theme';

const text = t.book;

export default function BookScreen() {
  const fade = useScrollFade();
  // The book Home already loaded: no empty page while the screen comes in
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(cachedBook);

  // Again each time she comes back: the family may have approved a new story
  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
    }, []),
  );

  // Loaded (her name and stories) or the reason it couldn't load; null while loading
  const ready = book && 'chapters' in book ? book : null;
  const failed = book && 'error' in book ? book.error : null;
  const chapters = ready?.chapters ?? [];
  // iPad on its side: her book big on the left, the chapters on the right
  const bigCover = ready ? <SideCover name={ready.name} /> : <View />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame side={bigCover}>
        <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
          <ScreenHeader backLabel={text.back} />

          {/* Like the cover of her book: the title in the book's letters, how many stories on the right */}
          <View accessibilityRole="header" style={styles.titles}>
            <Text style={styles.title}>{text.title}</Text>
            {ready ? <Text style={styles.subtitle}>{text.count(chapters.length)}</Text> : null}
          </View>

          {failed ? <Text style={styles.note}>{failed}</Text> : null}
          {ready && !chapters.length ? <Text style={styles.note}>{text.empty}</Text> : null}

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
                  accessibilityLabel={text.chapterA11y(chapter.number, chapter.title)}>
                  <ChapterCard title={chapter.title} index={i} number={chapter.number} />
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
  titles: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontFamily: serif,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  list: {
    marginTop: 18,
    gap: 16,
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
