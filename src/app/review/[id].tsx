import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveBot } from '@/components/live-bot';
import { PhotoDrop } from '@/components/photo-drop';
import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { deleteChapter, loadFamilyBook, saveChapterText, setChapterPhotos, setChapterStatus, type Draft } from '@/lib/book';
import { colors, fontWeight } from '@/theme';

const text = t.review;

/** Lowercase letters only, the same way the talk function compares her words */
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * One story (v2, frames "9 · A story" and "10 · Check a new story"). Bold type on white, her words.
 * Tap a paragraph to read it on its own (the others step back). A new story shows the words Hilo
 * wasn't sure of: tap one to fix it, then "Add to their book". Nothing enters her book without this.
 */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [name, setName] = useState('');
  const [chapter, setChapter] = useState<Draft | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [unsure, setUnsure] = useState<string[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fix, setFix] = useState('');
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Development only: the sample covers in Libro open a sample story (nothing is saved)
    if (__DEV__ && id.startsWith('sample')) {
      const c: Draft = {
        id,
        title: 'The day the river froze',
        quote: null,
        status: 'draft',
        createdAt: new Date().toISOString(),
        unheardWords: ['Visitación'],
        familyId: '',
        photos: [],
        paragraphs: [
          'That winter the river froze from one bank to the other. Nobody in Alcoy had seen it like that.',
          'My brother Pepe and I slid on our shoes all the way to the mill, and my mother shouted from the window that we would drown.',
          'The shoes were a present from my godmother, Visitación, who lived above the bakery.',
        ],
      };
      Promise.resolve().then(() => {
        setName('Sarah');
        setChapter(c);
        setParagraphs(c.paragraphs);
        setUnsure(['visitación']);
      });
      return;
    }
    loadFamilyBook().then((book) => {
      if ('error' in book) return setError(book.error);
      setName(book.name);
      const c = book.chapters.find((x) => x.id === id) ?? null;
      setChapter(c);
      if (c) {
        setParagraphs(c.paragraphs);
        // only the words that are really in the text, once each
        const inText = new Set(c.paragraphs.join(' ').split(/[^\p{L}\p{N}]+/u).map(bare));
        setUnsure([...new Set(c.unheardWords.map(bare))].filter((w) => w && inText.has(w)));
      }
    });
  }, [id]);

  const save = async (action: () => Promise<boolean>, done: string, wait = 0) => {
    if (saving) return;
    if (__DEV__ && id.startsWith('sample')) action = async () => (setAdded(true), true); // the sample saves nothing
    setSaving(true);
    setError(null);
    const ok = await action();
    setSaving(false);
    if (!ok) return setError(text.error);
    setTimeout(() => {
      router.back();
      toast(done);
    }, wait);
  };

  // Swap every copy of the doubtful word for the family's fix, keeping a capital where there was one
  const applyFix = () => {
    const from = fixing;
    const to = fix.trim();
    setFixing(null);
    setFix('');
    if (!from || !to) return;
    setParagraphs((ps) =>
      ps.map((p) =>
        p
          .split(/(\p{L}+)/u)
          .map((part) => (bare(part) === from ? (part[0] === part[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to) : part))
          .join(''),
      ),
    );
    setUnsure((u) => u.filter((w) => w !== from));
  };

  const addToBook = () =>
    save(
      async () => {
        if (!chapter) return false;
        const edited = paragraphs.join('\n') !== chapter.paragraphs.join('\n');
        if (edited && !(await saveChapterText(chapter.id, paragraphs, unsure))) return false;
        const ok = await setChapterStatus(chapter.id, 'approved');
        if (ok) setAdded(true); // the Bot smiles a moment before going back
        return ok;
      },
      text.toastApproved(name),
      reduce ? 0 : 700,
    );

  const white = <Stack.Screen options={{ contentStyle: { backgroundColor: colors.background } }} />;
  if (!chapter) {
    return (
      <SafeAreaView style={styles.safe}>
        {white}
        {error ? <Text style={[styles.error, styles.pad]}>{error}</Text> : null}
      </SafeAreaView>
    );
  }
  const draft = chapter.status === 'draft';
  // the word as it's written in her story (capital and accents), for the chips
  const asWritten = (w: string) => paragraphs.join(' ').split(/[^\p{L}\p{N}]+/u).find((x) => bare(x) === w) ?? w;
  const marked = new Set(draft ? unsure : []);
  const told = new Date(chapter.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  const layout = reduce ? undefined : LinearTransition.springify().damping(18).stiffness(220);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {white}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {t.familyBook.tab}</Text>
          </Pressable>

          {draft ? <Text style={styles.big}>{text.checkTitle}</Text> : null}
          <Text style={[styles.title, draft && styles.titleSmall]} accessibilityRole="header">
            {chapter.title}
          </Text>
          <Text style={styles.meta}>{text.inWords(told)}</Text>

          <View style={styles.story}>
            {paragraphs.map((p, i) => (
              <Pressable key={i} onPress={() => setFocus((f) => (f === i ? null : i))} accessibilityRole="text">
                <Text style={[styles.paragraph, focus !== null && focus !== i && styles.dim]}>
                  {p.split(/(\p{L}+)/u).map((part, k) =>
                    marked.has(bare(part)) ? (
                      <Text key={k} style={styles.unsureWord} onPress={() => setFixing(bare(part))}>
                        {part}
                      </Text>
                    ) : (
                      part
                    ),
                  )}
                </Text>
              </Pressable>
            ))}
            {chapter.quote ? <Text style={styles.quote}>“{chapter.quote}”</Text> : null}
          </View>

          {/* The words Hilo wasn't sure of: tap one, type it right */}
          {draft && unsure.length ? (
            <Animated.View layout={layout} style={styles.check}>
              <Text style={styles.label}>{text.unsure.toUpperCase()}</Text>
              <View style={styles.chips}>
                {unsure.map((w) => (
                  <PressScale key={w} onPress={() => setFixing(w)} accessibilityRole="button" accessibilityLabel={text.fixLabel(w)} style={[styles.chip, fixing === w && styles.chipOn]}>
                    <Text style={[styles.chipText, fixing === w && styles.chipTextOn]}>{asWritten(w)}</Text>
                  </PressScale>
                ))}
              </View>
              {fixing ? (
                <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} style={styles.fixRow}>
                  <TextInput
                    autoFocus
                    value={fix}
                    onChangeText={setFix}
                    placeholder={fixing}
                    placeholderTextColor="rgba(0,0,0,0.3)"
                    onSubmitEditing={applyFix}
                    returnKeyType="done"
                    accessibilityLabel={text.fixLabel(fixing)}
                    style={styles.fixInput}
                  />
                  <PressScale onPress={applyFix} accessibilityRole="button" style={styles.fixDone}>
                    <Text style={styles.fixDoneText}>{text.fixDone}</Text>
                  </PressScale>
                </Animated.View>
              ) : (
                <Text style={styles.hint}>{text.fixHint}</Text>
              )}
            </Animated.View>
          ) : null}

          {/* Photos for the story (the StackD File drop) */}
          <View style={styles.photos}>
            <PhotoDrop
              familyId={chapter.familyId}
              chapterId={chapter.id}
              photos={chapter.photos}
              onChange={(photos) => {
                setChapter((c) => (c ? { ...c, photos } : c));
                setChapterPhotos(chapter.id, photos).then((ok) => !ok && setError(text.error));
              }}
              title={text.addPhoto}
              hint={text.photoHint(name)}
              uploading={text.uploading}
              removeLabel={text.removePhoto}
              dry={__DEV__ && id.startsWith('sample')}
            />
          </View>

          <View style={styles.actions}>
            {draft ? (
              <>
                <PressScale onPress={addToBook} accessibilityRole="button" accessibilityHint={text.approveHint(name)} style={[styles.primary, saving && styles.busy]}>
                  {added ? <LiveBot size={30} color={colors.background} eyeColor={colors.ink} mood="speaking" /> : null}
                  <Text style={styles.primaryText}>{added ? text.toastApproved(name) : text.addToBook}</Text>
                </PressScale>
                <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" style={styles.quiet}>
                  <Text style={styles.quietText}>{text.discard}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <PressScale
                  onPress={() => Share.share({ message: text.shareMessage(name, chapter.title, paragraphs) })}
                  accessibilityRole="button"
                  style={styles.primary}>
                  <Text style={styles.primaryText}>{text.share}</Text>
                </PressScale>
                <Pressable onPress={() => save(() => setChapterStatus(chapter.id, 'draft'), text.toastDraft(name))} accessibilityRole="button" style={styles.quiet}>
                  <Text style={styles.quietText}>{saving ? t.common.saving : text.unapprove}</Text>
                </Pressable>
              </>
            )}

            {confirming ? (
              <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} style={styles.confirm}>
                <Text style={styles.confirmTitle}>{text.discardTitle}</Text>
                <Text style={styles.confirmText}>{text.discardText}</Text>
                <PressScale onPress={() => save(() => deleteChapter(chapter.id), text.toastDeleted)} accessibilityRole="button" style={styles.primary}>
                  <Text style={styles.primaryText}>{text.discardYes}</Text>
                </PressScale>
                <Pressable onPress={() => setConfirming(false)} accessibilityRole="button" style={styles.quiet}>
                  <Text style={styles.quietText}>{text.cancel}</Text>
                </Pressable>
              </Animated.View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pad: { padding: 24 },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 56 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  big: { marginTop: 20, fontSize: 56, lineHeight: 56, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.ink },
  title: { marginTop: 22, fontSize: 44, lineHeight: 46, fontWeight: fontWeight.bold, letterSpacing: -2, color: colors.ink },
  titleSmall: { marginTop: 18, fontSize: 26, lineHeight: 30, letterSpacing: -0.8 },
  meta: { marginTop: 10, fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted },
  story: { marginTop: 24, gap: 16 },
  paragraph: { fontSize: 21, lineHeight: 28, fontWeight: fontWeight.semibold, letterSpacing: -0.3, color: colors.ink },
  dim: { opacity: 0.28 },
  // a word Hilo wasn't sure of: on a grey band, dashed underline; tap it to fix it
  unsureWord: { backgroundColor: colors.surface, textDecorationLine: 'underline', textDecorationStyle: 'dashed', textDecorationColor: colors.ink },
  quote: { fontSize: 22, lineHeight: 29, fontWeight: fontWeight.bold, letterSpacing: -0.4, color: colors.muted },
  check: { marginTop: 28, gap: 10 },
  label: { fontSize: 13, fontWeight: fontWeight.semibold, letterSpacing: 1, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.ink },
  chipTextOn: { color: colors.onAccent },
  hint: { fontSize: 14, color: colors.muted },
  fixRow: { flexDirection: 'row', gap: 8 },
  fixInput: { flex: 1, height: 52, borderRadius: 26, paddingHorizontal: 18, fontSize: 18, fontWeight: fontWeight.semibold, color: colors.ink, backgroundColor: colors.surface },
  fixDone: { height: 52, borderRadius: 26, paddingHorizontal: 20, justifyContent: 'center', backgroundColor: colors.ink },
  fixDoneText: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.onAccent },
  photos: { marginTop: 28 },
  actions: { marginTop: 28, gap: 6 },
  primary: { height: 60, borderRadius: 30, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  busy: { opacity: 0.6 },
  primaryText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
  quiet: { height: 52, alignItems: 'center', justifyContent: 'center' },
  quietText: { fontSize: 16, fontWeight: fontWeight.semibold, color: colors.muted },
  confirm: { marginTop: 8, padding: 20, gap: 8, borderRadius: 28, backgroundColor: colors.surface },
  confirmTitle: { fontSize: 22, fontWeight: fontWeight.bold, color: colors.ink },
  confirmText: { fontSize: 16, lineHeight: 22, color: colors.muted, marginBottom: 6 },
  error: { fontSize: 15, lineHeight: 21, color: colors.error, fontWeight: fontWeight.semibold },
});
