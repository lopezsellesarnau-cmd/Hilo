import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadTodayDoses } from '@/components/today-pills';
import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { localNow, showTime, type Dose } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

const text = t.herPills;

type Senior = { id: string; family_id: string; timezone: string; display_name: string };
type Med = { id: string; name: string; doses: Dose[] };

/**
 * Sus pastillas (v2, frame "4 · Her pills"): today, one big card per pill. Dark while a dose is still to come,
 * light once today's are taken. When one is due, someone who is with her can mark it for her (source 'family').
 * At the bottom, the next one.
 */
export default function HerPillsScreen() {
  const reduce = useReducedMotion();
  const [senior, setSenior] = useState<Senior | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [now, setNow] = useState('00:00');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('people').select('id, family_id, timezone, display_name').eq('role', 'senior').limit(1).maybeSingle();
    if (!s) return;
    setSenior(s as Senior);
    setNow(localNow(s.timezone).time);
    setDoses(await loadTodayDoses(s.id, s.timezone));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setError(true));
    }, [load]),
  );

  // Marks the dose that's due as taken, on her behalf
  const mark = async (dose: Dose) => {
    if (!senior || busy) return;
    setBusy(dose.key);
    const { data: auth } = await supabase.auth.getUser();
    const { data: me } = await supabase.from('people').select('id').eq('user_id', auth.user?.id ?? '').eq('family_id', senior.family_id).maybeSingle();
    const { error: e } = await supabase.from('medication_events').upsert(
      {
        family_id: senior.family_id,
        medication_id: dose.medicationId,
        scheduled_date: localNow(senior.timezone).date,
        scheduled_time: dose.time,
        status: 'taken',
        confirmed_at: new Date().toISOString(),
        confirmed_by: me?.id ?? null,
        source: 'family',
      },
      { onConflict: 'medication_id,scheduled_date,scheduled_time' },
    );
    setBusy(null);
    if (e) return toast.error(t.common.saveFailed);
    toast(text.marked(dose.name));
    load().catch(() => {});
  };

  // One card per pill, in the order of its first dose today
  const meds: Med[] = [];
  for (const d of doses ?? []) {
    const m = meds.find((x) => x.id === d.medicationId);
    if (m) m.doses.push(d);
    else meds.push({ id: d.medicationId, name: d.name, doses: [d] });
  }
  const next = (doses ?? []).find((d) => !d.takenAt && d.time > now);
  const layout = reduce ? undefined : LinearTransition.springify().damping(16);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <View style={styles.top}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <Text style={styles.back}>‹ {t.health.title}</Text>
            </Pressable>
            {senior ? (
              <Pressable
                onPress={() => router.push({ pathname: '/onboarding/pills', params: { seniorId: senior.id, seniorName: senior.display_name, from: 'today' } })}
                accessibilityRole="button"
                hitSlop={12}>
                <Text style={styles.edit}>{text.edit}</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.title} accessibilityRole="header">
            {text.title}
          </Text>

          {!doses && !error ? <ActivityIndicator style={styles.spinner} color={colors.ink} /> : null}
          {error ? <Text style={styles.empty}>{t.common.loadFailed}</Text> : null}
          {doses && !doses.length ? <Text style={styles.empty}>{text.none}</Text> : null}

          <View style={styles.cards}>
            {meds.map((m, i) => {
              const done = m.doses.every((d) => d.takenAt);
              const due = m.doses.find((d) => !d.takenAt && d.time <= now);
              return (
                <Animated.View key={m.id} layout={layout} entering={reduce ? undefined : FadeInDown.delay(60 * i).springify().damping(15)}>
                  <View style={[styles.card, !done && styles.cardDark]} accessible={!due} accessibilityLabel={`${m.name}. ${m.doses.map((d) => showTime(d.time)).join(', ')}. ${done ? text.taken : text.later}`}>
                    <View style={styles.cardText}>
                      <Text style={[styles.name, !done && styles.onInk]} numberOfLines={2}>
                        {m.name}
                      </Text>
                      <Text style={[styles.times, !done && styles.timesDark]}>
                        {m.doses.map((d) => (d.takenAt ? `${showTime(d.time)} ✓` : showTime(d.time))).join('  ·  ')}
                      </Text>
                    </View>
                    {done ? (
                      <View style={[styles.pill, styles.pillInk]}>
                        <Text style={[styles.pillText, styles.onInk]}>{text.taken}</Text>
                      </View>
                    ) : due ? (
                      <PressScale onPress={() => mark(due)} accessibilityRole="button" accessibilityLabel={text.markA11y(m.name, showTime(due.time))} style={[styles.pill, busy === due.key && styles.busy]}>
                        <Text style={styles.pillText}>{text.mark}</Text>
                      </PressScale>
                    ) : (
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>{text.later}</Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {next ? (
            <View style={styles.next} accessible accessibilityLabel={`${text.next}: ${next.name}, ${showTime(next.time)}`}>
              <Text style={styles.nextLabel}>{text.next}</Text>
              <Text style={styles.nextTime}>{showTime(next.time)}</Text>
            </View>
          ) : doses?.length && doses.every((d) => d.takenAt) ? (
            <Text style={styles.allDone}>{text.allDone}</Text>
          ) : null}
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  back: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  edit: { fontSize: 17, fontWeight: fontWeight.bold, color: colors.ink },
  title: { marginTop: 18, fontSize: 64, lineHeight: 62, fontWeight: fontWeight.bold, letterSpacing: -3, color: colors.ink },
  spinner: { marginTop: 60 },
  empty: { marginTop: 24, fontSize: 18, fontWeight: fontWeight.semibold, color: colors.muted },
  cards: { marginTop: 32, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 20, borderRadius: 30, backgroundColor: colors.surface },
  cardDark: { backgroundColor: colors.ink },
  cardText: { flex: 1 },
  name: { fontSize: 28, lineHeight: 30, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.ink },
  times: { marginTop: 8, fontSize: 15, fontWeight: fontWeight.semibold, color: 'rgba(0,0,0,0.45)', fontVariant: ['tabular-nums'] },
  timesDark: { color: 'rgba(255,255,255,0.55)' },
  onInk: { color: colors.onAccent },
  pill: { height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.onAccent },
  pillInk: { backgroundColor: colors.ink },
  pillText: { fontSize: 15, fontWeight: fontWeight.bold, color: colors.ink },
  busy: { opacity: 0.5 },
  next: { marginTop: 'auto', paddingTop: 40, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  nextLabel: { fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted, marginBottom: 10 },
  nextTime: { fontSize: 64, lineHeight: 64, fontWeight: fontWeight.bold, letterSpacing: -3, color: colors.ink, fontVariant: ['tabular-nums'] },
  allDone: { marginTop: 'auto', paddingTop: 40, fontSize: 28, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.ink },
});
