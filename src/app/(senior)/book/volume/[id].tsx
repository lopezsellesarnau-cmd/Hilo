import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterCover } from '@/components/chapter-cover';
import { TRAY } from '@/components/record-flow';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { cachedBook, loadBook, photoLinks } from '@/lib/book';
import { goBack } from '@/lib/nav';
import { colors, fontWeight } from '@/theme';

const text = t.book;
const names = t.familyBook;

/**
 * One of her books, on her phone: black like the scroll. Its cover and name, then each chapter with its stories,
 * large and easy to tap. A story opens the reading page, where Hilo can read it to her.
 */
export default function HerVolumeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(cachedBook);
  const [cover, setCover] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const volume = book && 'books' in book ? book.books.find((b) => b.id === id) : undefined;
  const firstPhoto = volume?.chapters.flatMap((c) => c.stories).find((s) => s.photos[0])?.photos[0];
  useEffect(() => {
    if (!firstPhoto) return;
    let live = true;
    photoLinks([firstPhoto]).then((links) => live && setCover(links[firstPhoto]));
    return () => {
      live = false;
    };
  }, [firstPhoto]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => goBack('/book')} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {text.title}</Text>
          </Pressable>

          {book && 'error' in book ? <Text style={styles.meta}>{book.error}</Text> : null}

          {volume ? (
            <>
              <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={styles.thumb}>
                <ChapterCover index={volume.number - 1} photo={firstPhoto ? cover : undefined} size={64} />
              </Animated.View>
              <Text style={styles.meta}>{[names.bookN(volume.number), names.stories(volume.stories)].join(' · ')}</Text>
              <Animated.Text entering={reduce ? undefined : FadeInDown.delay(60).springify().damping(16)} style={styles.title} accessibilityRole="header">
                {volume.title ?? names.bookN(volume.number)}.
              </Animated.Text>

              {volume.chapters.map((c, ci) => (
                <Animated.View key={c.id} entering={reduce ? undefined : FadeInDown.delay(100 + 60 * ci).springify().damping(16)} style={styles.chapter}>
                  <Text style={styles.chapterN}>{names.chapterN(c.number)}</Text>
                  {c.title ? (
                    <Text style={styles.chapterTitle} accessibilityRole="header">
                      {c.title}
                    </Text>
                  ) : null}
                  <View style={styles.list}>
                    {c.stories.map((s) => (
                      <Pressable
                        key={s.id}
                        onPress={() => router.push({ pathname: '/book/[chapter]', params: { chapter: s.id } })}
                        accessibilityRole="button"
                        accessibilityLabel={s.title}
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                        <Text style={styles.story}>{s.title}</Text>
                        <Text style={styles.arrow}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </Animated.View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontSize: 20, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  thumb: { marginTop: 20, width: 112, height: 112, borderRadius: 24, overflow: 'hidden' },
  meta: { marginTop: 16, fontSize: 18, lineHeight: 24, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  title: { marginTop: 8, fontSize: 52, lineHeight: 54, fontWeight: fontWeight.bold, letterSpacing: -2.4, color: colors.onAccent },
  chapter: { marginTop: 40 },
  chapterN: { fontSize: 18, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  chapterTitle: { marginTop: 4, fontSize: 30, lineHeight: 34, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.onAccent },
  list: { marginTop: 14 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  pressed: { opacity: 0.6 },
  story: { flex: 1, fontSize: 24, lineHeight: 30, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: colors.onAccent },
  arrow: { fontSize: 30, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.4)' },
});
