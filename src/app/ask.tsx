import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardSwap } from '@/components/card-swap';
import { LiveBot } from '@/components/live-bot';
import { PressScale } from '@/components/press-scale';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { ask } from '@/lib/doc-read';
import { docKind, imageUri, listDocuments, type Doc } from '@/lib/documents';
import { goBack } from '@/lib/nav';
import { vaultState } from '@/lib/vault';
import { colors, fontWeight } from '@/theme';

const text = t.docs;

type Answer = { q: string; ids: string[] };

const when = (d: Doc) =>
  new Date(d.meta.date ? `${d.meta.date}T12:00:00` : d.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Pregunta a Hilo (v2, frame "5 · Ask Hilo, find the doc"). Ask in your own words; the phone searches what it read
 * in her documents (nothing leaves it). Your question in a black bubble, the Bot says "Here it is.", and a Card swap
 * holds only what it found, the best in front. Tap the front card to open it.
 */
export default function AskScreen() {
  const reduce = useReducedMotion();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);

  useFocusEffect(
    useCallback(() => {
      vaultState()
        .then(async (s) => {
          if (s.kind !== 'open') return setClosed(true);
          setDocs(await listDocuments());
        })
        .catch(() => setClosed(true));
    }, []),
  );

  const find = (q = question) => {
    const asked = q.trim();
    if (!asked || !docs) return;
    const ids = ask(
      asked,
      docs.map((d) => ({ id: d.id, title: d.meta.title, text: d.meta.text, kind: d.meta.kind, tags: d.meta.tags, date: d.meta.date, createdAt: d.createdAt })),
    );
    setAnswer({ q: asked, ids });
    setQuestion('');
  };

  const found = answer ? (answer.ids.map((id) => docs?.find((d) => d.id === id)).filter(Boolean) as Doc[]) : [];
  // Before asking: a few of her own documents' titles to try
  const tries = (docs ?? []).slice(0, 3).map((d) => d.meta.title);
  const enter = (i: number) => (reduce ? undefined : FadeInDown.delay(90 * i).springify().damping(15));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <WideFrame>
          <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => goBack('/documents')} accessibilityRole="button" hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>‹ {text.docsLabel}</Text>
            </Pressable>

            {!docs && !closed ? <ActivityIndicator style={styles.spinner} color={colors.ink} /> : null}

            {/* The folder isn't open on this phone (or there's none): open it first */}
            {closed ? (
              <Animated.View entering={enter(0)} style={styles.empty}>
                <LiveBot size={96} />
                <Text style={styles.big}>{text.askClosed}</Text>
                <PressScale onPress={() => router.replace('/documents')} accessibilityRole="button" style={styles.primary}>
                  <Text style={styles.primaryText}>{text.openFolder}</Text>
                </PressScale>
              </Animated.View>
            ) : null}

            {docs && !docs.length ? (
              <Animated.View entering={enter(0)} style={styles.empty}>
                <LiveBot size={96} />
                <Text style={styles.big}>{text.askEmpty}</Text>
                <PressScale onPress={() => router.replace('/documents')} accessibilityRole="button" style={styles.primary}>
                  <Text style={styles.primaryText}>{text.add}</Text>
                </PressScale>
              </Animated.View>
            ) : null}

            {/* Before asking: the Bot, big, and some of her documents to try */}
            {docs?.length && !answer ? (
              <View style={styles.intro}>
                <Animated.View entering={enter(0)}>
                  <LiveBot size={112} />
                </Animated.View>
                <Animated.Text entering={enter(1)} style={styles.title} accessibilityRole="header">
                  {text.askTitle}
                </Animated.Text>
                <Animated.Text entering={enter(2)} style={styles.hint}>
                  {text.askHint}
                </Animated.Text>
                <Animated.View entering={enter(3)} style={styles.tries}>
                  {tries.map((q) => (
                    <PressScale key={q} onPress={() => find(q)} accessibilityRole="button" style={styles.try}>
                      <Text style={styles.tryText} numberOfLines={1}>
                        {q}
                      </Text>
                    </PressScale>
                  ))}
                </Animated.View>
              </View>
            ) : null}

            {/* The answer: frame 5 */}
            {answer ? (
              <View key={answer.q}>
                <Animated.View entering={enter(0)} style={styles.qRow}>
                  <Text style={styles.qBubble}>{answer.q}</Text>
                </Animated.View>
                <Animated.View entering={enter(1)} style={styles.aRow} accessibilityLiveRegion="polite">
                  <LiveBot size={44} />
                  <Text style={styles.aText}>{found.length === 0 ? text.notFound : found.length === 1 ? text.here : text.hereMany}</Text>
                </Animated.View>
                {found.length === 0 ? (
                  <Animated.Text entering={enter(2)} style={styles.hint}>
                    {text.notFoundHint}
                  </Animated.Text>
                ) : (
                  <Animated.View entering={reduce ? undefined : FadeIn.delay(220).duration(320)} style={styles.stack}>
                    <CardSwap
                      items={found.map((d) => ({
                        id: d.id,
                        title: d.meta.title,
                        sub: when(d),
                        tag: docKind(d) === 'PDF' ? 'PDF' : text.photoTag,
                        loadImage: docKind(d) === 'PDF' ? undefined : () => imageUri(d),
                      }))}
                      onOpen={(id) => router.push({ pathname: '/document/[id]', params: { id } })}
                      hint={text.swapHint}
                      nextLabel={text.nextDoc}
                      cardWidth={240}
                      cardHeight={300}
                    />
                    <Text style={styles.swipe}>{found.length > 1 ? text.swipe : text.swapHint}</Text>
                  </Animated.View>
                )}
              </View>
            ) : null}
          </ScrollView>

          {/* The question, at the bottom like a message */}
          {docs?.length ? (
            <View style={styles.askRow}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => find()}
                placeholder={text.askPlaceholder}
                placeholderTextColor="rgba(0,0,0,0.35)"
                returnKeyType="search"
                accessibilityLabel={text.askLabel}
                style={styles.askInput}
              />
              <PressScale onPress={() => find()} accessibilityRole="button" accessibilityLabel={text.askSend} style={styles.askGo}>
                <LiveBot size={30} color={colors.onAccent} eyeColor={colors.ink} />
              </PressScale>
            </View>
          ) : null}
        </WideFrame>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  screen: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  spinner: { marginTop: 80 },
  empty: { marginTop: 40, gap: 18 },
  big: { fontSize: 34, lineHeight: 38, fontWeight: fontWeight.bold, letterSpacing: -1.2, color: colors.ink },
  primary: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  primaryText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
  intro: { marginTop: 32 },
  title: { marginTop: 20, fontSize: 56, lineHeight: 56, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.ink },
  hint: { marginTop: 10, fontSize: 18, lineHeight: 25, fontWeight: fontWeight.semibold, color: colors.muted },
  tries: { marginTop: 24, gap: 8, alignItems: 'flex-start' },
  try: { maxWidth: '100%', height: 44, borderRadius: 22, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: colors.surface },
  tryText: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.ink },
  qRow: { marginTop: 24, alignItems: 'flex-end' },
  qBubble: {
    maxWidth: '82%',
    overflow: 'hidden',
    borderRadius: 26,
    borderBottomRightRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: fontWeight.semibold,
    color: colors.onAccent,
    backgroundColor: colors.ink,
  },
  aRow: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aText: { flex: 1, fontSize: 40, lineHeight: 44, fontWeight: fontWeight.bold, letterSpacing: -1.6, color: colors.ink },
  stack: { marginTop: 36, alignItems: 'center' },
  swipe: { marginTop: 18, fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  askRow: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 6, height: 60, borderRadius: 30, backgroundColor: colors.surface },
  askInput: { flex: 1, height: 60, fontSize: 17, fontWeight: fontWeight.semibold, color: colors.ink },
  askGo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
});
