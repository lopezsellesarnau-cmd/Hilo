import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterCover } from '@/components/chapter-cover';
import { TRAY } from '@/components/record-flow';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadFamilyBooks, photoLinks, type LifeBook } from '@/lib/book';
import { colors, fontWeight } from '@/theme';
import { goBack } from '@/lib/nav';

const text = t.familyBook;

/**
 * One of her books (vault Senior-App/13-libro-en-libros-plan): black like the scroll. Its cover,
 * "Book 2 · 3 chapters · 9 stories", its name big, then each chapter with its stories in the order she told them.
 * A new one says so; tap one to read and review it.
 */
export default function HerBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [book, setBook] = useState<LifeBook | null>(null);
  const [empty, setEmpty] = useState(false);
  const [cover, setCover] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    loadFamilyBooks().then((all) => {
      if (!('books' in all)) return;
      const found = all.books.find((b) => b.id === id) ?? null;
      setBook(found);
      // its last story was deleted: nothing left here
      setEmpty(!found);
    });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [load]),
  );

  // The cover: the first photo in any of its stories
  const firstPhoto = book?.chapters.flatMap((c) => c.stories).find((s) => s.photos[0])?.photos[0];
  useEffect(() => {
    if (!firstPhoto) return;
    let live = true;
    photoLinks([firstPhoto]).then((links) => live && setCover(links[firstPhoto]));
    return () => {
      live = false;
    };
  }, [firstPhoto]);

  const told = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  let n = 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => goBack('/family/book')} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {text.tab}</Text>
          </Pressable>

          <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={styles.headRow}>
            <View style={styles.thumb}>
              <ChapterCover index={(book?.number ?? 1) - 1} photo={firstPhoto ? cover : undefined} size={48} />
            </View>
            {book ? (
              <Text style={styles.meta}>
                {text.bookN(book.number)}
                {'\n'}
                {[text.chapters(book.chapters.length), text.stories(book.stories), book.years].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Animated.View>

          {book ? (
            <Animated.Text entering={reduce ? undefined : FadeInDown.delay(60).springify().damping(16)} style={styles.title} accessibilityRole="header">
              {book.title ?? text.bookN(book.number)}.
            </Animated.Text>
          ) : null}

          {empty ? <Text style={styles.meta}>{text.emptyTitle}</Text> : null}

          {book?.chapters.map((c, ci) => (
            <Animated.View key={c.id} entering={reduce ? undefined : FadeInDown.delay(100 + 60 * ci).springify().damping(16)} style={styles.chapter}>
              <Text style={styles.chapterN}>{text.chapterN(c.number)}</Text>
              {c.title ? (
                <Text style={styles.chapterTitle} accessibilityRole="header">
                  {c.title}
                </Text>
              ) : null}
              <View style={styles.list}>
                {c.stories.map((s) => {
                  n += 1;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => router.push({ pathname: '/review/[id]', params: { id: s.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.title}${s.status === 'draft' ? `, ${text.newBadge}` : ''}`}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <Text style={styles.n}>{String(n).padStart(2, '0')}</Text>
                      <Text style={styles.story} numberOfLines={2}>
                        {s.title}
                      </Text>
                      {s.status === 'draft' ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{text.newBadge}</Text>
                        </View>
                      ) : (
                        <Text style={styles.when}>{s.year ?? told(s.createdAt)}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.4)' },
  headRow: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  thumb: { width: 92, height: 92, borderRadius: 20, overflow: 'hidden' },
  meta: { paddingBottom: 4, fontSize: 15, lineHeight: 21, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.45)' },
  title: { marginTop: 20, fontSize: 56, lineHeight: 56, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.onAccent },
  chapter: { marginTop: 36 },
  chapterN: { fontSize: 15, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.45)' },
  chapterTitle: { marginTop: 4, fontSize: 28, lineHeight: 32, fontWeight: fontWeight.bold, letterSpacing: -0.9, color: colors.onAccent },
  list: { marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.6 },
  n: { width: 28, fontSize: 15, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.3)', fontVariant: ['tabular-nums'] },
  story: { flex: 1, fontSize: 20, lineHeight: 24, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.onAccent },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.onAccent },
  badgeText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
  when: { fontSize: 15, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.35)', fontVariant: ['tabular-nums'] },
});
