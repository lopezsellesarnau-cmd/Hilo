import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterCover } from '@/components/chapter-cover';
import { RecordFlow, TRAY, type FlowItem } from '@/components/record-flow';
import { t } from '@/i18n';
import { loadFamilyBooks, photoLinks, type LifeBook } from '@/lib/book';
import { colors, fontWeight } from '@/theme';

const text = t.familyBook;

/**
 * Libro (v2, frame "7 · Her book"): black, her books as records (the StackD Record flow, vertical), oldest first.
 * Each book is up to 3 chapters of her stories (vault Senior-App/13-libro-en-libros-plan). It opens on the first
 * book with a story waiting for the family, or the last one. Tap the middle card to open the book.
 */
export default function FamilyBookScreen() {
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadFamilyBooks>> | null>(null);
  // Short-lived links to each story's first photo (private bucket), for the covers
  const [covers, setCovers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!book || !('books' in book)) return;
    const firsts = book.books.map((b) => firstPhoto(b)).filter((p): p is string => Boolean(p));
    let live = true;
    photoLinks(firsts)
      .then((links) => live && setCovers(links))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [book]);

  useEffect(() => {
    loadFamilyBooks().then(setBook);
  }, []);
  useFocusEffect(
    useCallback(() => {
      loadFamilyBooks().then(setBook);
      // a black page: white status bar while it's open
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const books = book && 'books' in book ? book.books : [];
  const chapters = book && 'books' in book ? book.stories : [];
  const waiting = chapters.filter((c) => c.status === 'draft').length;
  const firstNew = books.findIndex((b) => b.waiting > 0);
  // Development only: with no stories yet, sample covers so the Record flow can be tried in the simulator
  const sample = __DEV__ && book !== null && 'books' in book && !chapters.length;
  const items: FlowItem[] = sample
    ? ['Growing up', 'School years', 'Meeting Vicente', 'The house in Altea', 'The children', 'Recipes'].map((title, i) => ({
        id: `sample-${i}`,
        title,
        sub: 'Sample (dev only)',
        badge: i === 5 ? t.familyBook.newBadge : undefined,
        cover: <ChapterCover index={i} />,
      }))
    : books.map((b) => {
        const photo = firstPhoto(b);
        return {
          id: b.id,
          title: b.title ?? text.bookN(b.number),
          sub: [text.chapters(b.chapters.length), text.stories(b.stories), b.years].filter(Boolean).join(' · '),
          badge: b.waiting ? t.familyBook.newBadge : undefined,
          cover: <ChapterCover index={b.number - 1} photo={photo ? covers[photo] : undefined} />,
        };
      });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {text.herBook}
        </Text>
        {book && 'books' in book ? (
          <Text style={styles.count}>
            {t.book.count(chapters.length - waiting)}
            {waiting ? ` · ${text.waiting(waiting)}` : ''}
          </Text>
        ) : null}
        {book && 'error' in book ? <Text style={styles.count}>{book.error}</Text> : null}
      </View>

      {book && 'books' in book && !chapters.length && !sample ? (
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
            onOpen={(i) =>
              sample ? router.push({ pathname: '/review/[id]', params: { id: items[i].id } }) : router.push({ pathname: '/her-book/[id]', params: { id: books[i].id } })
            }
            label={text.herBook}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** A book's cover: the first photo in any of its stories */
const firstPhoto = (b: LifeBook) => b.chapters.flatMap((c) => c.stories).find((s) => s.photos[0])?.photos[0];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY },
  head: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontSize: 56, lineHeight: 58, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.onAccent },
  count: { marginTop: 8, fontSize: 17, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.45)' },
  empty: { paddingHorizontal: 24, paddingTop: 40 },
  emptyTitle: { fontSize: 28, fontWeight: fontWeight.bold, color: colors.onAccent },
  flow: { flex: 1, marginTop: 8, marginBottom: 84 },
});
