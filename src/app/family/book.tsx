import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { chapterShape } from '@/components/chapter-card';
import { LiveBot } from '@/components/live-bot';
import { RecordFlow, TRAY, type FlowItem } from '@/components/record-flow';
import { dateLocale, t } from '@/i18n';
import { loadFamilyBook, type Draft } from '@/lib/book';
import { colors, fontWeight } from '@/theme';

const text = t.familyBook;

/** Quiet tones for the covers, one per chapter, round and round (no colour in v2) */
// all light: on the black page a dark cover read as a shadow block
const TONES = ['#ffffff', '#e9e7e2', '#d9d6cf', '#f2f2f0', '#cfcbc2', '#ecebe7'];
const LIGHT = new Set(TONES);

/** '2026-10-14T…' → '14 oct' */
const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

/** A chapter's cover: its Bot shape, big and calm, on a quiet tone */
function Cover({ index }: { index: number }) {
  const tone = TONES[index % TONES.length];
  const light = LIGHT.has(tone);
  return (
    <View style={[styles.cover, { backgroundColor: tone }]}>
      <LiveBot size={120} shape={chapterShape(index + 1)} color={light ? colors.ink : colors.background} eyeColor={light ? colors.background : colors.ink} />
    </View>
  );
}

/**
 * Libro (v2, frame "7 · Her book"): black, her stories as records (the StackD Record flow, vertical).
 * Oldest at the top like her book; it opens on the first story waiting for the family, or the newest.
 * Tap the middle card to read it (and approve it, if it's new).
 */
export default function FamilyBookScreen() {
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadFamilyBook>> | null>(null);

  useEffect(() => {
    loadFamilyBook().then(setBook);
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadFamilyBook().then(setBook);
      // a black page: white status bar while it's open
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  // Oldest first, like in her book
  const chapters: Draft[] = book && 'chapters' in book ? [...book.chapters].reverse() : [];
  const waiting = chapters.filter((c) => c.status === 'draft').length;
  const firstNew = chapters.findIndex((c) => c.status === 'draft');
  // Development only: with no stories yet, sample covers so the Record flow can be tried in the simulator
  const sample = __DEV__ && book !== null && 'chapters' in book && !chapters.length;
  const items: FlowItem[] = sample
    ? ['Growing up', 'School years', 'Meeting Vicente', 'The house in Altea', 'The children', 'Recipes'].map((title, i) => ({
        id: `sample-${i}`,
        title,
        sub: 'Sample (dev only)',
        badge: i === 5 ? t.familyBook.newBadge : undefined,
        cover: <Cover index={i} />,
      }))
    : chapters.map((c, i) => ({
    id: c.id,
    title: c.title,
    sub: day(c.createdAt),
    badge: c.status === 'draft' ? t.familyBook.newBadge : undefined,
    cover: <Cover index={i} />,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {text.herBook}
        </Text>
        {book && 'chapters' in book ? (
          <Text style={styles.count}>
            {t.book.count(chapters.length - waiting)}
            {waiting ? ` · ${text.waiting(waiting)}` : ''}
          </Text>
        ) : null}
        {book && 'error' in book ? <Text style={styles.count}>{book.error}</Text> : null}
      </View>

      {book && 'chapters' in book && !chapters.length && !sample ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
          <Text style={styles.count}>{text.emptyText}</Text>
        </View>
      ) : null}

      {items.length ? (
        <View style={styles.flow}>
          <RecordFlow
            key={items.length}
            items={items}
            start={firstNew >= 0 ? firstNew : items.length - 1}
            onOpen={(i) => (chapters[i] ? router.push({ pathname: '/review/[id]', params: { id: chapters[i].id } }) : undefined)}
            label={text.herBook}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY },
  head: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 56, lineHeight: 58, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.onAccent },
  count: { marginTop: 8, fontSize: 17, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.45)' },
  empty: { paddingHorizontal: 24, paddingTop: 40 },
  emptyTitle: { fontSize: 28, fontWeight: fontWeight.bold, color: colors.onAccent },
  flow: { flex: 1, marginTop: 8, marginBottom: 84 },
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 30 },
});
