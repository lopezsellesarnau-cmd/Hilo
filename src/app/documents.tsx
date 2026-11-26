import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardSwap } from '@/components/card-swap';
import { DocDrop } from '@/components/doc-drop';
import { LiveBot } from '@/components/live-bot';
import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { docKind, imageUri, listDocuments, type Doc } from '@/lib/documents';
import { approveDevice, askForAccess, createVault, recoverWithCode, removeDevice, vaultState, type Device, type VaultState } from '@/lib/vault';
import { colors, fontWeight } from '@/theme';

const text = t.docs;

/**
 * Documentos (v2, phase A: the keys). Her documents, locked end to end: only the family's phones open them.
 * Here: create the folder (and save the recovery code, shown once), let a new phone in, or open it with the code.
 * Adding and finding documents comes in phase B.
 */
export default function DocumentsScreen() {
  const reduce = useReducedMotion();
  const [state, setState] = useState<VaultState | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null); // the new recovery code, on screen once
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [sure, setSure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[] | null>(null);

  const loadDocs = useCallback(() => {
    listDocuments()
      .then(setDocs)
      .catch(() => setError(t.common.loadFailed));
  }, []);
  const load = useCallback(() => {
    vaultState()
      .then((s) => {
        setState(s);
        if (s.kind === 'open') loadDocs();
      })
      .catch(() => setError(t.common.loadFailed));
  }, [loadDocs]);
  useFocusEffect(load);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError(t.common.saveFailed);
    }
    setBusy(false);
  };

  const create = () => run(async () => setCode(await createVault()));
  const recover = () =>
    run(async () => {
      if (await recoverWithCode(typed)) {
        setTyping(false);
        setTyped('');
        toast(text.opened);
        load();
      } else setError(text.wrongCode);
    });
  const approve = (d: Device) =>
    run(async () => {
      await approveDevice(d);
      toast(text.approved(d.name));
      load();
    });
  const remove = (d: Device) => {
    if (sure !== d.id) return setSure(d.id);
    setSure(null);
    run(async () => {
      await removeDevice(d);
      load();
    });
  };

  const openDoc = (id: string) => router.push({ pathname: '/document/[id]', params: { id } });

  const layout = reduce ? undefined : LinearTransition.springify().damping(18);
  const enter = reduce ? undefined : FadeInDown.springify().damping(16);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {t.health.title}</Text>
          </Pressable>

          {!state && !error ? <ActivityIndicator style={styles.spinner} color={colors.ink} /> : null}

          {/* The new recovery code: shown once */}
          {code ? (
            <Animated.View entering={enter}>
              <Text style={styles.big} accessibilityRole="header">
                {text.saveCodeTitle}
              </Text>
              <Text style={styles.body}>{text.saveCodeText}</Text>
              <View style={styles.codeBox} accessible accessibilityLabel={code.split('').join(' ')}>
                {code.split('-').map((g, i) => (
                  <Text key={i} style={styles.codeGroup}>
                    {g}
                  </Text>
                ))}
              </View>
              <Text style={styles.warn}>{text.loseWarning}</Text>
              <PressScale onPress={() => Share.share({ message: text.shareCode(code) })} accessibilityRole="button" style={styles.primary}>
                <Text style={styles.primaryText}>{text.saveCode}</Text>
              </PressScale>
              <Pressable
                onPress={() => {
                  setCode(null);
                  load();
                }}
                accessibilityRole="button"
                style={styles.quiet}>
                <Text style={styles.quietText}>{text.savedIt}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* No folder yet */}
          {!code && state?.kind === 'none' ? (
            <Animated.View entering={enter}>
              <View style={styles.bot}>
                <LiveBot size={96} />
              </View>
              <Text style={styles.big} accessibilityRole="header">
                {text.title}
              </Text>
              <Text style={styles.body}>{text.intro}</Text>
              <PressScale onPress={create} accessibilityRole="button" style={[styles.primary, busy && styles.busy]}>
                <Text style={styles.primaryText}>{busy ? t.common.saving : text.create}</Text>
              </PressScale>
            </Animated.View>
          ) : null}

          {/* There's a folder, but this phone isn't in */}
          {!code && state?.kind === 'locked' ? (
            <Animated.View entering={enter} layout={layout}>
              <Text style={styles.big} accessibilityRole="header">
                {text.title}
              </Text>
              <Text style={styles.body}>{state.registered ? text.waiting : text.lockedText}</Text>
              {state.registered ? (
                <PressScale onPress={load} accessibilityRole="button" style={styles.primary}>
                  <Text style={styles.primaryText}>{text.check}</Text>
                </PressScale>
              ) : (
                <PressScale onPress={() => run(async () => (await askForAccess(), load()))} accessibilityRole="button" style={[styles.primary, busy && styles.busy]}>
                  <Text style={styles.primaryText}>{text.ask}</Text>
                </PressScale>
              )}
              {typing ? (
                <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} style={styles.codeEntry}>
                  <TextInput
                    autoFocus
                    value={typed}
                    onChangeText={setTyped}
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    placeholderTextColor="rgba(0,0,0,0.25)"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel={text.codeLabel}
                    style={styles.codeInput}
                  />
                  <PressScale onPress={recover} accessibilityRole="button" style={[styles.primary, busy && styles.busy]}>
                    <Text style={styles.primaryText}>{busy ? text.opening : text.open}</Text>
                  </PressScale>
                </Animated.View>
              ) : (
                <Pressable onPress={() => setTyping(true)} accessibilityRole="button" style={styles.quiet}>
                  <Text style={styles.quietText}>{text.useCode}</Text>
                </Pressable>
              )}
            </Animated.View>
          ) : null}

          {/* Open: add (File drop with her Bot), the documents, and the phones that can open them */}
          {!code && state?.kind === 'open' ? (
            <Animated.View entering={enter} layout={layout}>
              <Text style={styles.big} accessibilityRole="header">
                {text.title}
              </Text>
              {docs?.length ? (
                <View style={styles.stack}>
                  <CardSwap
                    items={docs.map((d) => ({
                      id: d.id,
                      title: d.meta.title,
                      sub: when(d.createdAt),
                      tag: docKind(d) === 'PDF' ? 'PDF' : text.photoTag,
                      loadImage: docKind(d) === 'PDF' ? undefined : () => imageUri(d),
                    }))}
                    onOpen={openDoc}
                    hint={text.swapHint}
                    nextLabel={text.nextDoc}
                  />
                  {docs.length > 1 ? <Text style={styles.swipe}>{text.swipe}</Text> : null}
                </View>
              ) : null}

              <View style={styles.drop}>
                <DocDrop onAdded={loadDocs} />
              </View>

              <Text style={styles.label}>{text.docsLabel.toUpperCase()}</Text>
              {docs && !docs.length ? <Text style={styles.empty}>{text.empty}</Text> : null}
              {docs?.map((d) => (
                <Animated.View key={d.id} entering={enter} layout={layout}>
                  <Pressable onPress={() => openDoc(d.id)} accessibilityRole="button" accessibilityLabel={d.meta.title} style={({ pressed }) => [styles.doc, pressed && styles.docPressed]}>
                    <View style={[styles.docTag, docKind(d) === 'PDF' && styles.docTagDark]}>
                      <Text style={[styles.docTagText, docKind(d) === 'PDF' && styles.docTagTextDark]}>{docKind(d) === 'PDF' ? 'PDF' : text.photoTag}</Text>
                    </View>
                    <View style={styles.deviceText}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {d.meta.title}
                      </Text>
                      <Text style={styles.deviceSub}>
                        {when(d.createdAt)} · {size(d.size)}
                      </Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </Pressable>
                </Animated.View>
              ))}

              <Text style={[styles.label, styles.labelGap]}>{text.phones.toUpperCase()}</Text>
              {state.devices.map((d) => (
                <Animated.View key={d.id} layout={layout} style={styles.device}>
                  <View style={styles.deviceText}>
                    <Text style={styles.deviceName}>{d.name}</Text>
                    <Text style={styles.deviceSub}>{d.mine ? text.thisPhone : d.approved ? text.canOpen : text.wantsIn}</Text>
                  </View>
                  {!d.approved ? (
                    <PressScale onPress={() => approve(d)} accessibilityRole="button" accessibilityLabel={text.approve} style={styles.pill}>
                      <Text style={styles.pillText}>{text.approve}</Text>
                    </PressScale>
                  ) : null}
                  {!d.mine ? (
                    <PressScale onPress={() => remove(d)} accessibilityRole="button" accessibilityLabel={`${text.remove}: ${d.name}`} style={[styles.x, sure === d.id && styles.xSure]}>
                      <Text style={[styles.xText, sure === d.id && styles.xTextSure]}>{sure === d.id ? text.removeSure : '✕'}</Text>
                    </PressScale>
                  ) : null}
                </Animated.View>
              ))}
            </Animated.View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const when = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 56 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  spinner: { marginTop: 80 },
  bot: { marginTop: 24 },
  big: { marginTop: 18, fontSize: 52, lineHeight: 54, fontWeight: fontWeight.bold, letterSpacing: -2.4, color: colors.ink },
  body: { marginTop: 12, marginBottom: 24, fontSize: 18, lineHeight: 25, fontWeight: fontWeight.semibold, color: colors.muted },
  codeBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 20, borderRadius: 28, backgroundColor: colors.ink },
  codeGroup: { width: '30%', fontSize: 26, fontWeight: fontWeight.bold, letterSpacing: 2, color: colors.onAccent, fontVariant: ['tabular-nums'], fontFamily: 'Menlo' },
  warn: { marginTop: 16, marginBottom: 20, fontSize: 15, lineHeight: 21, fontWeight: fontWeight.semibold, color: colors.ink },
  primary: { height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  busy: { opacity: 0.5 },
  primaryText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
  quiet: { height: 52, alignItems: 'center', justifyContent: 'center' },
  quietText: { fontSize: 16, fontWeight: fontWeight.semibold, color: colors.muted },
  codeEntry: { marginTop: 16, gap: 10 },
  codeInput: { height: 58, borderRadius: 29, paddingHorizontal: 20, fontSize: 17, fontWeight: fontWeight.bold, letterSpacing: 1, color: colors.ink, backgroundColor: colors.surface, fontFamily: 'Menlo' },
  label: { marginTop: 8, marginBottom: 4, fontSize: 13, fontWeight: fontWeight.semibold, letterSpacing: 1, color: colors.muted },
  drop: { marginBottom: 28 },
  stack: { marginTop: 4, marginBottom: 32, alignItems: 'center' },
  swipe: { marginTop: 18, fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  labelGap: { marginTop: 36 },
  empty: { paddingVertical: 14, fontSize: 16, fontWeight: fontWeight.semibold, color: colors.muted },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  docPressed: { opacity: 0.6 },
  docTag: { width: 48, height: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  docTagDark: { backgroundColor: colors.ink },
  docTagText: { fontSize: 12, fontWeight: fontWeight.bold, letterSpacing: 0.5, color: colors.ink },
  docTagTextDark: { color: colors.onAccent },
  chev: { fontSize: 26, fontWeight: fontWeight.semibold, color: 'rgba(0,0,0,0.25)' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  deviceText: { flex: 1 },
  deviceName: { fontSize: 19, fontWeight: fontWeight.bold, color: colors.ink },
  deviceSub: { marginTop: 2, fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  pill: { height: 40, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.ink },
  pillText: { fontSize: 15, fontWeight: fontWeight.bold, color: colors.onAccent },
  x: { minWidth: 36, height: 36, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  xSure: { backgroundColor: colors.ink },
  xText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
  xTextSure: { color: colors.onAccent },
  error: { marginTop: 16, fontSize: 15, lineHeight: 21, color: colors.error, fontWeight: fontWeight.semibold },
});
