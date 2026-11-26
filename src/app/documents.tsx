import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LiveBot } from '@/components/live-bot';
import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
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

  const load = useCallback(() => {
    vaultState()
      .then(setState)
      .catch(() => setError(t.common.loadFailed));
  }, []);
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

          {/* Open: the phones that can see the documents (documents themselves: phase B) */}
          {!code && state?.kind === 'open' ? (
            <Animated.View entering={enter} layout={layout}>
              <Text style={styles.big} accessibilityRole="header">
                {text.title}
              </Text>
              <Text style={styles.body}>{text.emptyForNow}</Text>

              <Text style={styles.label}>{text.phones.toUpperCase()}</Text>
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
