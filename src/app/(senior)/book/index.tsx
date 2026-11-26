import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChapterCover } from '@/components/chapter-cover';
import { RecordFlow, TRAY, type FlowItem } from '@/components/record-flow';
import { t } from '@/i18n';
import { cachedBook, loadBook, photoLinks, type HerBook } from '@/lib/book';
import { goBack } from '@/lib/nav';
import { colors, fontSize, fontWeight } from '@/theme';

const text = t.book;
const names = t.familyBook;

/** A book's cover: the first photo in any of its stories */
const firstPhoto = (b: HerBook) => b.chapters.flatMap((c) => c.stories).find((s) => s.photos[0])?.photos[0];

/**
 * Mi libro (vault Senior-App/13-libro-en-libros-plan): her books as records, black like the family's,
 * the same scroll. Only what the family approved. It opens on her newest book; tap the middle one to open it.
 */
export default function BookScreen() {
  // The book Home already loaded: no empty page while the screen comes in
  const [book, setBook] = useState<Awaited<ReturnType<typeof loadBook>> | null>(cachedBook);
  const [covers, setCovers] = useState<Record<string, string>>({});

  // Again each time she comes back: the family may have approved a new story
  useFocusEffect(
    useCallback(() => {
      loadBook().then(setBook);
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const ready = book && 'books' in book ? book : null;
  const failed = book && 'error' in book ? book.error : null;
  const books = useMemo(() => ready?.books ?? [], [ready]);

  useEffect(() => {
    const firsts = books.map(firstPhoto).filter((p): p is string => Boolean(p));
    if (!firsts.length) return;
    let live = true;
    photoLinks(firsts)
      .then((links) => live && setCovers(links))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [books]);

  const items: FlowItem[] = books.map((b) => {
    const photo = firstPhoto(b);
    return {
      id: b.id,
      title: b.title ?? names.bookN(b.number),
      sub: names.stories(b.stories),
      cover: <ChapterCover index={b.number - 1} photo={photo ? covers[photo] : undefined} />,
    };
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Pressable onPress={() => goBack('/home')} accessibilityRole="button" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹ {text.back}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {text.title}.
        </Text>
        {ready ? <Text style={styles.count}>{text.count(ready.chapters.length)}</Text> : null}
      </View>

      {failed ? <Text style={styles.note}>{failed}</Text> : null}
      {ready && !books.length ? <Text style={styles.note}>{text.empty}</Text> : null}

      {items.length ? (
        <View style={styles.flow}>
          <RecordFlow
            key={items.length}
            items={items}
            start={items.length - 1}
            onOpen={(i) => router.push({ pathname: '/book/volume/[id]', params: { id: books[i].id } })}
            label={text.title}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TRAY },
  head: { paddingHorizontal: 24, paddingTop: 8 },
  back: { alignSelf: 'flex-start', paddingVertical: 8 },
  backText: { fontSize: 20, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  title: { marginTop: 12, fontSize: 56, lineHeight: 58, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.onAccent },
  count: { marginTop: 8, fontSize: 20, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  note: { marginTop: 40, paddingHorizontal: 24, fontSize: fontSize.talk, lineHeight: 30, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.7)' },
  flow: { flex: 1, marginTop: 8, marginBottom: 24 },
});
