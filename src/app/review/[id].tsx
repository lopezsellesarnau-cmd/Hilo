import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { deleteChapter, loadFamilyBook, setChapterStatus, type Draft } from '@/lib/book';
import { colors, family, fontWeight, spacing } from '@/theme';

const text = {
  back: '‹ Libro',
  backLabel: 'Volver a Libro',
  draft: 'PARA REVISAR',
  approved: 'EN SU LIBRO',
  promise: (name: string) => `Todo son palabras de ${name}. No inventamos nada.`,
  check: (name: string) =>
    `Revisa lo marcado: no aparece en lo que dijo ${name}. Si no es suyo, descarta la historia.`,
  approve: 'Aprobar',
  approveHint: (name: string) => `${name} la verá en Mi libro`,
  unapprove: 'Quitar de su libro',
  discard: 'Descartar',
  discardTitle: '¿Descartar esta historia?',
  discardText: 'Se borra para siempre. Sus charlas no se borran.',
  discardYes: 'Sí, descartar',
  cancel: 'Cancelar',
  error: 'No se ha podido guardar. Comprueba tu conexión y vuelve a probar.',
};

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

  if (!chapter) {
    return (
      <SafeAreaView style={styles.safe}>{error ? <Text style={[styles.error, styles.screen]}>{error}</Text> : null}</SafeAreaView>
    );
  }
  const draft = chapter.status === 'draft';
  const unheard = new Set(chapter.unheardWords);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={text.backLabel} hitSlop={12}>
          <Text style={styles.back}>{text.back}</Text>
        </Pressable>

        <Text style={styles.kicker}>{draft ? text.draft : text.approved}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {chapter.title}
        </Text>
        <Text style={styles.promise}>{text.promise(name)}</Text>
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
                label={saving ? 'Guardando…' : text.approve}
                onPress={() => save(() => setChapterStatus(chapter.id, 'approved'))}
                accessibilityHint={text.approveHint(name)}
              />
              <BigButton scale="family" variant="outline" label={text.discard} onPress={() => setConfirming(true)} />
            </>
          ) : (
            <BigButton
              scale="family"
              variant="outline"
              label={saving ? 'Guardando…' : text.unapprove}
              onPress={() => save(() => setChapterStatus(chapter.id, 'draft'))}
            />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 48,
    gap: 14,
  },
  back: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  kicker: {
    marginTop: 8,
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  title: {
    marginTop: -8,
    fontSize: 30,
    fontWeight: '700',
    color: colors.ink,
  },
  promise: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  checkBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#f2f5f1',
  },
  checkText: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  paragraph: {
    fontSize: family.fontSize.body,
    lineHeight: 28,
    color: colors.ink,
  },
  // A word she never said: sage underline, easy to spot without shouting
  unheard: {
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: colors.sage,
    backgroundColor: 'rgba(143, 168, 138, 0.2)',
  },
  quote: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
    marginVertical: 6,
  },
  actions: {
    marginTop: 12,
    gap: 12,
  },
  confirm: {
    marginTop: 6,
    padding: 18,
    gap: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e6e8e4',
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
