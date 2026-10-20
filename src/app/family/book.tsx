import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCover } from '@/components/book-cover';
import { ListRow } from '@/components/list-row';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadFamilyBook, type Draft } from '@/lib/book';
import { colors, family, fontWeight, spacing } from '@/theme';

const text = t.familyBook;

/** '2026-10-14T…' → '14 oct' */
const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

const open = (chapter: Draft) => router.push({ pathname: '/review/[id]', params: { id: chapter.id } });

/**
 * Libro: the stories from her talks. The family approves each one before she sees it in Mi libro.
 * Same look as her book (18 oct): her cover on top, the stories as pills. Black = waiting for you.
 */
export default function FamilyBookScreen() {
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadFamilyBook>> | null>(null);

  // The tabs are preloaded (lazy: false): load at start too, so this tab is ready before it's opened
  useEffect(() => {
    loadFamilyBook().then(setBook);
  }, []);

  // Again when coming back from a review
  useFocusEffect(
    useCallback(() => {
      loadFamilyBook().then(setBook);
    }, []),
  );

  const chapters = book && 'chapters' in book ? book.chapters : [];
  const drafts = chapters.filter((c) => c.status === 'draft');
  // Oldest first, like in her book
  const approved = chapters.filter((c) => c.status === 'approved').reverse();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.head}>
            {/* The space is kept while loading, so the title never jumps */}
            <View style={styles.cover}>
              {book && 'name' in book ? <BookCover width={COVER} title={t.book.cover(book.name)} /> : null}
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            {book && 'chapters' in book ? <Text style={styles.subtitle}>{t.book.count(approved.length)}</Text> : null}
          </View>

          {book && 'error' in book ? <Text style={styles.note}>{book.error}</Text> : null}

          {book && 'chapters' in book && !chapters.length ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
              <Text style={styles.note}>{text.emptyText}</Text>
            </View>
          ) : null}

          {drafts.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>{text.toReview}</Text>
              {drafts.map((c) => (
                <ListRow
                  key={c.id}
                  dark
                  kicker={day(c.createdAt).toUpperCase()}
                  title={c.title}
                  detail={c.unheardWords.length ? text.check(c.unheardWords.length) : undefined}
                  onPress={() => open(c)}
                />
              ))}
            </View>
          ) : null}

          {approved.length ? (
            <View style={styles.section}>
              <Text style={styles.label}>{text.inBook}</Text>
              {approved.map((c, i) => (
                <ListRow key={c.id} kicker={t.book.kicker(i + 1)} title={c.title} onPress={() => open(c)} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

// Large, like the cover of a real book: it is the first thing the family sees here
const COVER = 220;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 48,
    gap: 28,
  },
  head: {
    alignItems: 'center',
  },
  cover: {
    width: COVER,
    height: (COVER * 250) / 200,
  },
  title: {
    marginTop: 14,
    fontSize: 36,
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
  section: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  note: {
    maxWidth: 320,
    alignSelf: 'center',
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
  },
});
