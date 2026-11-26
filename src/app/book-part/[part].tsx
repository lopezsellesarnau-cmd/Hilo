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
import { groupParts, loadFamilyBook, photoLinks, PARTS, type BookPart, type Part } from '@/lib/book';
import { colors, fontWeight } from '@/theme';
import { goBack } from '@/lib/nav';

const text = t.familyBook;

/**
 * One chapter of her book (v2, frame "8 · A chapter"): black like the book. Its cover, "Chapter 2 · 6 stories · 1934–46",
 * the name big, and its stories in the order she told them. A new one says so; tap one to read it (frame 9).
 */
export default function BookPartScreen() {
  const { part = 'more' } = useLocalSearchParams<{ part: Part }>();
  const reduce = useReducedMotion();
  const [chapter, setChapter] = useState<BookPart | null>(null);
  const [empty, setEmpty] = useState(false);
  const [cover, setCover] = useState<string | undefined>(undefined);

  const load = useCallback(() => {
    loadFamilyBook().then((book) => {
      if (!('chapters' in book)) return;
      const found = groupParts(book.chapters).find((p) => p.part === part) ?? null;
      setChapter(found);
      // moved its last story away: nothing left here
      setEmpty(!found);
    });
  }, [part]);

  useFocusEffect(
    useCallback(() => {
      load();
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, [load]),
  );

  // The cover: the first photo in any of its stories
  const firstPhoto = chapter?.stories.find((s) => s.photos[0])?.photos[0];
  useEffect(() => {
    if (!firstPhoto) return;
    let live = true;
    photoLinks([firstPhoto]).then((links) => live && setCover(links[firstPhoto]));
    return () => {
      live = false;
    };
  }, [firstPhoto]);

  const told = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  const name = text.parts[part as Part] ?? text.parts.more;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => goBack('/family/book')} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {text.tab}</Text>
          </Pressable>

          <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(16)} style={styles.headRow}>
            <View style={styles.thumb}>
              <ChapterCover index={PARTS.indexOf(part as Part)} photo={firstPhoto ? cover : undefined} size={48} />
            </View>
            {chapter ? (
              <Text style={styles.meta}>
                {text.chapterN(chapter.number)}
                {'\n'}
                {[text.stories(chapter.stories.length), chapter.years].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Animated.View>

          <Animated.Text entering={reduce ? undefined : FadeInDown.delay(60).springify().damping(16)} style={styles.title} accessibilityRole="header">
            {name}.
          </Animated.Text>

          {empty ? <Text style={styles.meta}>{text.emptyTitle}</Text> : null}

          <View style={styles.list}>
            {chapter?.stories.map((s, i) => (
              <Animated.View key={s.id} entering={reduce ? undefined : FadeInDown.delay(100 + 50 * i).springify().damping(16)}>
                <Pressable
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: s.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.title}${s.status === 'draft' ? `, ${text.newBadge}` : ''}`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <Text style={styles.n}>{String(i + 1).padStart(2, '0')}</Text>
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
              </Animated.View>
            ))}
          </View>
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
  list: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  pressed: { opacity: 0.6 },
  n: { width: 28, fontSize: 15, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.3)', fontVariant: ['tabular-nums'] },
  story: { flex: 1, fontSize: 20, lineHeight: 24, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.onAccent },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.onAccent },
  badgeText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
  when: { fontSize: 15, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.35)', fontVariant: ['tabular-nums'] },
});
