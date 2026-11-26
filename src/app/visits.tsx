import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { WheelPicker } from '@/components/wheel-picker';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { addVisit, deleteVisit, loadVisits, visitWhen, zonedIso, type Visit } from '@/lib/visits';
import { colors, fontWeight } from '@/theme';

const text = t.visits;
type Senior = { id: string; family_id: string; timezone: string };

/** The next 120 days, as wheel options: 'Fri 27 Nov' */
function days(timeZone: string) {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 120; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const value = d.toLocaleDateString('en-CA', { timeZone }); // 2026-11-27
    const label = d.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).replace(/\./g, '');
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}
const HOURS = Array.from({ length: 14 }, (_, i) => ({ value: String(i + 7).padStart(2, '0'), label: String(i + 7).padStart(2, '0') }));
const MINUTES = ['00', '15', '30', '45'].map((m) => ({ value: m, label: m }));

/**
 * Citas (v2): her medical visits. The next ones in bold, and a quick form with the wheels:
 * what, where, which day, what time. The soonest one shows on Hoy as a split-flap board.
 */
export default function VisitsScreen() {
  const reduce = useReducedMotion();
  const [senior, setSenior] = useState<Senior | null>(null);
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [day, setDay] = useState('');
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [saving, setSaving] = useState(false);
  const [sure, setSure] = useState<string | null>(null); // a visit whose ✕ was tapped once

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('people').select('id, family_id, timezone').eq('role', 'senior').limit(1).maybeSingle();
    if (!s) return;
    setSenior(s as Senior);
    setDay((d) => d || new Date().toLocaleDateString('en-CA', { timeZone: s.timezone }));
    setVisits(await loadVisits(s.id));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  const save = async () => {
    if (!senior || saving || !title.trim()) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: me } = await supabase.from('people').select('id').eq('user_id', auth.user?.id ?? '').maybeSingle();
    const ok = await addVisit({ familyId: senior.family_id, seniorId: senior.id, title, place, startsAt: zonedIso(day, `${hour}:${minute}`, senior.timezone), addedBy: me?.id ?? null });
    setSaving(false);
    if (!ok) return toast.error(t.common.saveFailed);
    toast(text.saved);
    setTitle('');
    setPlace('');
    setVisits(await loadVisits(senior.id));
  };

  const remove = async (v: Visit) => {
    if (sure !== v.id) return setSure(v.id);
    setSure(null);
    if (!(await deleteVisit(v.id))) return toast.error(t.common.saveFailed);
    setVisits((list) => list?.filter((x) => x.id !== v.id) ?? null);
    toast(text.deleted);
  };

  const layout = reduce ? undefined : LinearTransition.springify().damping(18);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {t.health.title}</Text>
          </Pressable>
          <Text style={styles.big} accessibilityRole="header">
            {text.title}
          </Text>

          {visits && !visits.length ? <Text style={styles.none}>{text.none}</Text> : null}
          {senior && visits
            ? visits.map((v) => (
                <Animated.View key={v.id} entering={reduce ? undefined : FadeInDown.springify().damping(16)} layout={layout} style={styles.visit}>
                  <View style={styles.visitText}>
                    <Text style={styles.visitTitle}>{v.title}</Text>
                    <Text style={styles.visitWhen}>
                      {visitWhen(v.startsAt, senior.timezone)}
                      {v.place ? ` · ${v.place}` : ''}
                    </Text>
                  </View>
                  <PressScale onPress={() => remove(v)} accessibilityRole="button" accessibilityLabel={`${text.delete}: ${v.title}`} style={[styles.x, sure === v.id && styles.xSure]}>
                    <Text style={[styles.xText, sure === v.id && styles.xTextSure]}>{sure === v.id ? text.deleteSure : '✕'}</Text>
                  </PressScale>
                </Animated.View>
              ))
            : null}

          {/* A new visit: what, where, when (the wheels) */}
          {senior ? (
            <View style={styles.form}>
              <Text style={styles.label}>{text.add.toUpperCase()}</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder={text.whatPlaceholder} placeholderTextColor="rgba(0,0,0,0.3)" accessibilityLabel={text.what} style={styles.input} maxLength={60} />
              <TextInput value={place} onChangeText={setPlace} placeholder={text.wherePlaceholder} placeholderTextColor="rgba(0,0,0,0.3)" accessibilityLabel={text.where} style={styles.input} maxLength={120} />
              <View style={styles.wheels}>
                <View style={styles.dayWheel}>
                  <WheelPicker options={days(senior.timezone)} value={day} onChange={setDay} label={text.day} itemHeight={52} fontSize={22} />
                </View>
                <View style={styles.timeWheel}>
                  <WheelPicker options={HOURS} value={hour} onChange={setHour} label={text.hour} itemHeight={52} fontSize={28} />
                </View>
                <Text style={styles.colon}>:</Text>
                <View style={styles.timeWheel}>
                  <WheelPicker options={MINUTES} value={minute} onChange={setMinute} label={text.minute} itemHeight={52} fontSize={28} />
                </View>
              </View>
              <PressScale onPress={save} accessibilityRole="button" style={[styles.save, (!title.trim() || saving) && styles.saveOff]}>
                <Text style={styles.saveText}>{saving ? t.common.saving : text.save}</Text>
              </PressScale>
            </View>
          ) : null}
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
  big: { marginTop: 18, marginBottom: 18, fontSize: 56, lineHeight: 58, fontWeight: fontWeight.bold, letterSpacing: -2.6, color: colors.ink },
  none: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted, marginBottom: 8 },
  visit: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.12)' },
  visitText: { flex: 1 },
  visitTitle: { fontSize: 24, fontWeight: fontWeight.bold, letterSpacing: -0.6, color: colors.ink },
  visitWhen: { marginTop: 4, fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted },
  x: { minWidth: 36, height: 36, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  xSure: { backgroundColor: colors.ink },
  xText: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.ink },
  xTextSure: { color: colors.onAccent },
  form: { marginTop: 32, gap: 10 },
  label: { fontSize: 13, fontWeight: fontWeight.semibold, letterSpacing: 1, color: colors.muted },
  input: { height: 56, borderRadius: 28, paddingHorizontal: 20, fontSize: 18, fontWeight: fontWeight.semibold, color: colors.ink, backgroundColor: colors.surface },
  wheels: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dayWheel: { flex: 2.2 },
  timeWheel: { flex: 1 },
  colon: { fontSize: 30, fontWeight: fontWeight.bold, color: colors.ink, marginBottom: 4 },
  save: { marginTop: 6, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  saveOff: { opacity: 0.35 },
  saveText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
});
