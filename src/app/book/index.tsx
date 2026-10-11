import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { sampleBook, sampleChapters } from '@/data/sample';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

export default function BookScreen() {
  const fade = useScrollFade();
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
        <ScreenHeader backLabel="Inicio" title="Mi libro" subtitle={`${sampleBook.storyCount} historias guardadas`} />

        <View style={styles.cover}>
          <BookCover width={Math.min(220, width * 0.55)} title={sampleBook.title} caption={sampleBook.place} />
        </View>

        <View style={styles.list}>
          {sampleChapters.map((chapter) =>
            chapter.status === 'approved' ? (
              <PressScale
                key={chapter.number}
                onPress={() => router.push({ pathname: '/book/[chapter]', params: { chapter: String(chapter.number) } })}
                accessibilityRole="button"
                accessibilityLabel={`Capítulo ${chapter.number}, ${chapter.title}`}
                style={styles.chapter}>
                <View style={styles.chapterText}>
                  <Text style={styles.kicker}>CAPÍTULO {chapter.number}</Text>
                  <Text style={styles.chapterTitle}>{chapter.title}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </PressScale>
            ) : (
              <View key={chapter.number} style={styles.soon}>
                <Text style={styles.soonTitle}>{chapter.title}</Text>
                <Text style={styles.soonNote}>Lo estamos escribiendo contigo</Text>
              </View>
            ),
          )}
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
  soon: {
    paddingVertical: 8,
    paddingHorizontal: 26,
  },
  soonTitle: {
    fontSize: 24,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  soonNote: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
});
