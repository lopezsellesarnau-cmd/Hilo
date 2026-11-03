import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CHAPTER_CARD, ChapterCard } from '@/components/chapter-card';
import { BotFace } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadFamilyBook, type Draft } from '@/lib/book';
import { colors, family, fontWeight, serif, spacing } from '@/theme';

const text = t.familyBook;

/** '2026-10-14T…' → '14 oct' */
const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });

const open = (chapter: Draft) => router.push({ pathname: '/review/[id]', params: { id: chapter.id } });

/** The stacked chapter cards (Figma "en su libro"): each one shows this much before the next covers it */
const STEP = 94;

/**
 * Libro: the stories from her talks. The family approves each one before she sees it in Mi libro.
 * Her cover on top, the stories waiting for you, and her book as a stack of cards.
 */
export default function FamilyBookScreen() {
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadFamilyBook>> | null>(null);

  // Load at start too, so this tab is ready before it's opened
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
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
          <View style={styles.cover}>
            <View style={styles.coverText}>
              <Text style={styles.coverLabel}>{t.today.bookWidget}</Text>
              {book && 'name' in book ? (
                <Text style={styles.coverTitle} accessibilityRole="header">
                  {t.book.cover(book.name)}
                </Text>
              ) : null}
              {book && 'chapters' in book ? <Text style={styles.coverLabel}>{t.book.count(approved.length)}</Text> : null}
            </View>
            <View style={styles.coverBot}>
              <BotFace size={180} face={colors.ink} eyes={colors.background} />
            </View>
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
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{text.toReview}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{drafts.length}</Text>
                </View>
              </View>
              {drafts.map((c) => (
                <View key={c.id} style={styles.draft}>
                  <Text style={styles.kicker}>{day(c.createdAt).toUpperCase()}</Text>
                  <Text style={styles.draftTitle}>{c.title}</Text>
                  {c.paragraphs[0] ? (
                    <Text style={styles.snippet} numberOfLines={3}>
                      {c.paragraphs[0]}
                    </Text>
                  ) : null}
                  {c.unheardWords.length ? <Text style={styles.check}>{text.check(c.unheardWords.length)}</Text> : null}
                  <PressScale
                    onPress={() => open(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`${text.readApprove}: ${c.title}`}
                    style={styles.button}>
                    <Text style={styles.buttonText}>{text.readApprove}</Text>
                  </PressScale>
                </View>
              ))}
            </View>
          ) : null}

          {approved.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{text.inBook}</Text>
              <View style={{ height: (approved.length - 1) * STEP + CHAPTER_CARD }}>
                {approved.map((c, i) => (
                  <PressScale
                    key={c.id}
                    onPress={() => open(c)}
                    accessibilityRole="button"
                    accessibilityLabel={t.book.chapterA11y(i + 1, c.title)}
                    containerStyle={[styles.cardSlot, { top: i * STEP }]}
                    style={i > 0 && styles.cardShadow}>
                    <ChapterCard title={c.title} index={i} />
                  </PressScale>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </WideFrame>
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
    paddingBottom: 48,
    gap: 22,
  },
  cover: {
    height: 230,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  coverText: {
    position: 'absolute',
    left: 22,
    top: 22,
    right: 120,
    gap: 6,
  },
  coverLabel: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: '#555555',
  },
  coverTitle: {
    fontFamily: serif,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  coverBot: {
    position: 'absolute',
    right: -24,
    bottom: -66,
    transform: [{ scaleX: -1 }],
  },
  section: {
    gap: 14,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    paddingHorizontal: 8,
    fontSize: 22,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff6a3d',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  draft: {
    gap: 10,
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  kicker: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#555555',
  },
  draftTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  snippet: {
    fontFamily: serif,
    fontSize: 17,
    lineHeight: 25,
    color: '#3a3a3c',
  },
  check: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.nudge,
  },
  button: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: colors.ink,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: fontWeight.bold,
    color: colors.onAccent,
  },
  cardSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  // The card on top casts a shadow on the one behind it
  cardShadow: {
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 13,
    elevation: 8,
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
