import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { tagLabel } from '@/lib/doc-read';
import { cachedDoc, deleteDocument, docKind, imageUri, renameDocument, showPdf } from '@/lib/documents';
import { colors, fontWeight } from '@/theme';
import { goBack } from '@/lib/nav';

const text = t.docs;

/**
 * One document, opened on this phone. A photo is unlocked in memory and shown here;
 * a PDF opens in the system's viewer (unlocked into a temporary file that's removed after).
 * The title can be changed (locked again before it's saved). Delete takes two taps.
 */
export default function DocumentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [doc] = useState(() => cachedDoc(id));
  const [title, setTitle] = useState(doc?.meta.title ?? '');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);

  // Not open on this phone (the folder is locked after a restart): back to the list
  useEffect(() => {
    if (!doc) goBack('/documents');
  }, [doc]);

  useEffect(() => {
    if (!doc || docKind(doc) === 'PDF') return;
    let live = true;
    imageUri(doc)
      .then((uri) => live && setImage(uri))
      .catch(() => live && setError(text.couldNotOpen));
    return () => {
      live = false;
    };
  }, [doc]);

  if (!doc) return null;
  const pdf = docKind(doc) === 'PDF';

  const saveTitle = async () => {
    if (title.trim() === doc.meta.title || !title.trim()) return setTitle(doc.meta.title);
    if (await renameDocument(doc, title)) toast(t.common.saved);
    else toast.error(t.common.saveFailed);
  };

  const openPdf = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await showPdf(doc);
    } catch {
      setError(text.couldNotOpen);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!sure) return setSure(true);
    if (await deleteDocument(doc)) {
      toast(text.deleted);
      goBack('/documents');
    } else toast.error(t.common.saveFailed);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => goBack('/documents')} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {text.docsLabel}</Text>
          </Pressable>

          <TextInput
            value={title}
            onChangeText={setTitle}
            onEndEditing={saveTitle}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            accessibilityLabel={text.titleLabel}
            style={styles.title}
          />
          <Text style={styles.sub}>
            {text.added(new Date(doc.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }))}
          </Text>
          {/* What the phone read it as: the type and the specialty */}
          {doc.meta.kind || doc.meta.tags?.length ? (
            <View style={styles.tags}>
              {[doc.meta.kind, ...(doc.meta.tags ?? [])].filter(Boolean).map((id) => (
                <Text key={id} style={styles.tag}>
                  {tagLabel(id as string)}
                </Text>
              ))}
            </View>
          ) : null}

          {pdf ? (
            <PressScale onPress={openPdf} accessibilityRole="button" style={[styles.primary, busy && styles.busy]}>
              <Text style={styles.primaryText}>{busy ? text.opening : text.openPdf}</Text>
            </PressScale>
          ) : image ? (
            <Animated.View entering={reduce ? undefined : FadeIn.duration(260)}>
              <Image source={{ uri: image }} style={styles.image} contentFit="contain" accessibilityLabel={doc.meta.title} />
            </Animated.View>
          ) : !error ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {doc.meta.read ? (
            <View style={styles.read}>
              <Pressable onPress={() => setShowText((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showText }} style={styles.readHead}>
                <Text style={styles.readTitle}>{text.hiloRead}</Text>
                <Text style={styles.readChev}>{showText ? '−' : '+'}</Text>
              </Pressable>
              {showText ? (
                <Animated.View entering={reduce ? undefined : FadeIn.duration(200)}>
                  <Text selectable style={styles.readText}>
                    {doc.meta.text?.trim() || text.nothingRead}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          ) : null}

          <Pressable onPress={remove} accessibilityRole="button" style={[styles.delete, sure && styles.deleteSure]}>
            <Text style={[styles.deleteText, sure && styles.deleteTextSure]}>{sure ? text.deleteSure : text.delete}</Text>
          </Pressable>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 56 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  title: { marginTop: 18, padding: 0, fontSize: 40, lineHeight: 44, fontWeight: fontWeight.bold, letterSpacing: -1.6, color: colors.ink },
  sub: { marginTop: 8, marginBottom: 24, fontSize: 16, fontWeight: fontWeight.semibold, color: colors.muted },
  tags: { marginTop: -12, marginBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { overflow: 'hidden', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, fontWeight: fontWeight.bold, color: colors.ink, backgroundColor: colors.surface },
  read: { marginTop: 28, borderRadius: 24, paddingHorizontal: 18, backgroundColor: colors.surface },
  readHead: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readTitle: { fontSize: 17, fontWeight: fontWeight.bold, color: colors.ink },
  readChev: { fontSize: 24, fontWeight: fontWeight.semibold, color: colors.muted },
  readText: { paddingBottom: 18, fontSize: 15, lineHeight: 22, color: colors.ink },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 24, backgroundColor: colors.surface },
  loading: { aspectRatio: 3 / 4, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  primary: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  busy: { opacity: 0.5 },
  primaryText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
  error: { marginTop: 16, fontSize: 15, lineHeight: 21, color: colors.error, fontWeight: fontWeight.semibold },
  delete: { marginTop: 28, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  deleteSure: { backgroundColor: colors.error },
  deleteText: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.ink },
  deleteTextSure: { color: colors.onAccent },
});
