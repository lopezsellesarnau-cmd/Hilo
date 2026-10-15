import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadFamilyBook, type Draft } from '@/lib/book';
import { colors, family, fontWeight, spacing } from '@/theme';

const bookIcon = require('../../../assets/icons/book.svg');

const text = {
  title: 'Libro',
  toReview: 'PARA REVISAR',
  inBook: 'EN SU LIBRO',
  emptyTitle: 'Aún no hay historias',
  emptyText: 'Cuando empiece a charlar con Hilo, aquí aparecerán sus historias para que las revises.',
  check: (n: number) => (n === 1 ? '1 palabra para revisar' : `${n} palabras para revisar`),
};

/** '2026-10-14T…' → '14 oct' */
const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function StoryRow({ chapter }: { chapter: Draft }) {
  const draft = chapter.status === 'draft';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/review/[id]', params: { id: chapter.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.story, draft && styles.storyDraft, pressed && styles.pressed]}>
      <View style={styles.storyText}>
        <Text style={styles.storyTitle}>{chapter.title}</Text>
        <Text style={styles.storyNote}>
          {day(chapter.createdAt)}
          {draft && chapter.unheardWords.length ? ` · ${text.check(chapter.unheardWords.length)}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

/** Libro: the stories from her talks. The family approves each one before she sees it in Mi libro. */
export default function FamilyBookScreen() {
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadFamilyBook>> | null>(null);

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
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title} accessibilityRole="header">
          {text.title}
        </Text>
        {book && 'error' in book ? <Text style={styles.error}>{book.error}</Text> : null}

        {book && 'chapters' in book && !chapters.length ? (
          <View style={styles.empty}>
            <Image source={bookIcon} style={styles.book} contentFit="contain" />
            <Text style={styles.emptyTitle}>{text.emptyTitle}</Text>
            <Text style={styles.emptyText}>{text.emptyText}</Text>
          </View>
        ) : null}

        {drafts.length ? (
          <>
            <Text style={styles.section}>{text.toReview}</Text>
            {drafts.map((c) => (
              <StoryRow key={c.id} chapter={c} />
            ))}
          </>
        ) : null}

        {approved.length ? (
          <>
            <Text style={styles.section}>{text.inBook}</Text>
            {approved.map((c) => (
              <StoryRow key={c.id} chapter={c} />
            ))}
          </>
        ) : null}
      </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 40,
    gap: 12,
  },
  title: {
    fontSize: family.fontSize.title,
    fontWeight: '700',
    color: colors.ink,
  },
  section: {
    marginTop: 14,
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  story: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#e6e8e4',
  },
  // The only filled block: what is waiting for them
  storyDraft: {
    borderColor: '#f2f5f1',
    backgroundColor: '#f2f5f1',
  },
  pressed: {
    opacity: 0.6,
  },
  storyText: {
    flex: 1,
    gap: 2,
  },
  storyTitle: {
    fontSize: 20,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  storyNote: {
    fontSize: family.fontSize.note,
    color: colors.muted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 60,
  },
  book: {
    width: 92,
    height: 113,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyText: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 300,
  },
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
  },
});
