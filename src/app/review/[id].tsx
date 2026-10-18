import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ScreenHeader } from '@/components/screen-header';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { deleteChapter, loadFamilyBook, setChapterStatus, type Draft } from '@/lib/book';
import { colors, family, fontWeight, serif, spacing } from '@/theme';

const text = t.review;

/** Lowercase letters only, the same way the talk function compares her words */
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** A paragraph with the words she never said marked */
function Marked({ paragraph, unheard }: { paragraph: string; unheard: Set<string> }) {
  return (
    <Text style={styles.paragraph}>
      {paragraph.split(/(\p{L}+)/u).map((part, i) =>
        unheard.has(bare(part)) ? (
          <Text key={i} style={styles.unheard}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

/** One story from a talk: read it, check the marked words, approve or discard */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState('');
  const [chapter, setChapter] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFamilyBook().then((book) => {
      if ('error' in book) return setError(book.error);
      setName(book.name);
      setChapter(book.chapters.find((c) => c.id === id) ?? null);
    });
  }, [id]);

  const save = async (action: () => Promise<boolean>) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const ok = await action();
    setSaving(false);
    if (!ok) return setError(text.error);
    router.back();
  };

  // Paper behind the screen too, so it never flashes white while it slides in
  const paper = <Stack.Screen options={{ contentStyle: { backgroundColor: colors.paper } }} />;

  if (!chapter) {
    return (
      <SafeAreaView style={styles.safe}>
        {paper}
        {error ? <Text style={[styles.error, styles.screen]}>{error}</Text> : null}
      </SafeAreaView>
    );
  }
  const draft = chapter.status === 'draft';
  const unheard = new Set(chapter.unheardWords);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {paper}
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <ScreenHeader backLabel={t.familyBook.tab} />

          {/* Set like her chapter page: the story reads the way she will read it in her book */}
          <View style={styles.header}>
            <Text style={styles.kicker}>{draft ? text.draft : text.approved}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {chapter.title}
            </Text>
            <View style={styles.rule} />
            <Text style={styles.promise}>{text.promise(name)}</Text>
          </View>
          {draft && unheard.size ? (
            <View style={styles.checkBox}>
              <Text style={styles.checkText}>{text.check(name)}</Text>
            </View>
          ) : null}

          {chapter.paragraphs.map((p, i) => (
            <Marked key={i} paragraph={p} unheard={draft ? unheard : new Set()} />
          ))}
          {chapter.quote ? <Text style={styles.quote}>“{chapter.quote}”</Text> : null}

          <View style={styles.actions}>
            {draft ? (
              <>
                <BigButton
                  scale="family"
                  label={saving ? t.common.saving : text.approve}
                  onPress={() => save(() => setChapterStatus(chapter.id, 'approved'))}
                  accessibilityHint={text.approveHint(name)}
                />
                <BigButton scale="family" variant="outline" label={text.discard} onPress={() => setConfirming(true)} />
              </>
            ) : (
              <>
                <BigButton
                  scale="family"
                  label={text.share}
                  onPress={() => Share.share({ message: text.shareMessage(name, chapter.title, chapter.paragraphs) })}
                />
                <BigButton
                  scale="family"
                  variant="outline"
                  label={saving ? t.common.saving : text.unapprove}
                  onPress={() => save(() => setChapterStatus(chapter.id, 'draft'))}
                />
              </>
            )}

            {confirming ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmTitle}>{text.discardTitle}</Text>
                <Text style={styles.confirmText}>{text.discardText}</Text>
                <BigButton scale="family" label={text.discardYes} onPress={() => save(() => deleteChapter(chapter.id))} />
                <BigButton scale="family" variant="outline" label={text.cancel} onPress={() => setConfirming(false)} />
              </View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenX + 6,
    paddingTop: spacing.screenTop,
    paddingBottom: 56,
    gap: 16,
  },
  header: {
    marginTop: 10,
    alignItems: 'center',
  },
  kicker: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    color: '#6b6457',
    marginBottom: 10,
  },
  title: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 38,
    color: colors.ink,
    textAlign: 'center',
  },
  rule: {
    width: 40,
    height: 1,
    marginTop: 16,
    backgroundColor: colors.ink,
  },
  promise: {
    marginTop: 12,
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#6b6457',
    textAlign: 'center',
  },
  // Black like everything that waits for the family
  checkBox: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.accent,
  },
  checkText: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    fontWeight: fontWeight.semibold,
    color: colors.onAccent,
  },
  paragraph: {
    fontFamily: serif,
    fontSize: 20,
    lineHeight: 31,
    color: '#1a1a1a',
  },
  // A word she never said: bold and underlined on a soft band, easy to spot without shouting
  unheard: {
    fontFamily: undefined,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: colors.accent,
    backgroundColor: 'rgba(17, 17, 17, 0.1)',
  },
  quote: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 21,
    lineHeight: 30,
    color: '#4a453c',
    textAlign: 'center',
    marginVertical: 8,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  confirm: {
    marginTop: 6,
    padding: 20,
    gap: 12,
    borderRadius: 28,
    backgroundColor: colors.background,
  },
  confirmTitle: {
    fontSize: family.fontSize.subtitle,
    fontWeight: '700',
    color: colors.ink,
  },
  confirmText: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.muted,
    marginBottom: 6,
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
