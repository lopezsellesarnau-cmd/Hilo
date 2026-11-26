import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { PressScale } from '@/components/press-scale';
import { TextField } from '@/components/text-field';
import { WheelPicker } from '@/components/wheel-picker';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

// The wheels: any hour of her day, in quarters
const HOURS = Array.from({ length: 19 }, (_, i) => String(i + 5).padStart(2, '0')).map((h) => ({ value: h, label: h }));
const MINUTES = ['00', '15', '30', '45'].map((m) => ({ value: m, label: m }));

/** medications.times allows up to 8 */
const MAX_TIMES = 8;
type Medication = { id: string; name: string; times: string[] };

// Postgres returns '09:00:00'; show '9:00'
const showTime = (t: string) => t.slice(0, 5).replace(/^0/, '');

export default function PillsStep() {
  const { seniorId = '', seniorName = '', from = '' } = useLocalSearchParams<{
    seniorId: string;
    seniorName: string;
    /** 'today' or 'settings' when opened from Hoy or Ajustes: go back there instead of on to pairing */
    from?: string;
  }>();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [pills, setPills] = useState<Medication[]>([]);
  const [name, setName] = useState('');
  const reduce = useReducedMotion();
  const [times, setTimes] = useState<string[]>(['09:00']);
  // The wheels: the time to add next
  const [hour, setHour] = useState('21');
  const [minute, setMinute] = useState('00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAdd = name.trim().length > 0 && times.length > 0 && familyId !== null && !saving;

  // Load what is already there, in case the user came back with "Atrás"
  useEffect(() => {
    supabase
      .from('people')
      .select('family_id, medications(id, name, times)')
      .eq('id', seniorId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setError(t.common.loadFailed);
          return;
        }
        setFamilyId(data.family_id);
        setPills((data.medications ?? []) as Medication[]);
      });
  }, [seniorId]);

  const add = async () => {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('medications')
      .insert({ family_id: familyId, person_id: seniorId, name: name.trim(), times })
      .select('id, name, times')
      .single();
    setSaving(false);
    if (e || !data) {
      setError(t.common.saveFailed);
      return;
    }
    setPills((p) => [...p, data as Medication]);
    setName('');
    setTimes(['09:00']);
  };

  // The time on the wheels joins the list (in order, once)
  const addTime = () => {
    const v = `${hour}:${minute}`;
    setTimes((ts) => (ts.includes(v) || ts.length >= MAX_TIMES ? ts : [...ts, v].sort()));
  };
  const dropTime = (v: string) => setTimes((ts) => ts.filter((x) => x !== v));
  const layout = reduce ? undefined : LinearTransition.springify().damping(16);

  const remove = async (id: string) => {
    setError(null);
    const { error: e } = await supabase.from('medications').delete().eq('id', id);
    if (e) {
      setError(t.pillsStep.removeFailed);
      return;
    }
    setPills((p) => p.filter((x) => x.id !== id));
  };

  const next = () => {
    if (from) return router.back();
    router.push({ pathname: '/onboarding/pair', params: { seniorId, seniorName } });
  };

  return (
    <OnboardingStep
      step={from === 'settings' ? undefined : 5}
      mood={saving ? 'thinking' : 'idle'}
      question={t.pillsStep.question(seniorName)}
      hint={t.pillsStep.hint}
      footer={
        <BigButton
          scale="family"
          variant={pills.length ? 'fill' : 'outline'}
          label={from === 'settings' ? t.common.done : pills.length ? t.common.continue : t.common.later}
          onPress={next}
        />
      }>
      {pills.map((p) => (
        <View key={p.id} style={styles.pill}>
          <View style={styles.pillText}>
            <Text style={styles.pillName}>{p.name}</Text>
            <Text style={styles.pillTimes}>{p.times.map(showTime).join(' · ')}</Text>
          </View>
          <Pressable
            onPress={() => remove(p.id)}
            accessibilityRole="button"
            accessibilityLabel={t.pillsStep.removeA11y(p.name)}
            hitSlop={10}>
            <Text style={styles.remove}>{t.pillsStep.remove}</Text>
          </Pressable>
        </View>
      ))}

      <TextField
        label={t.pillsStep.nameLabel}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder={t.pillsStep.namePlaceholder}
        autoCapitalize="sentences"
        maxLength={80}
        returnKeyType="done"
      />
      <Text style={styles.label}>{t.pillsStep.timeLabel}</Text>
      {/* The times so far, as capsules: tap one to take it off */}
      <Animated.View layout={layout} style={styles.caps} accessibilityLabel={t.pillsStep.timesA11y}>
        {times.map((v) => (
          <Animated.View key={v} layout={layout} entering={reduce ? undefined : FadeIn.springify().damping(14)} exiting={reduce ? undefined : FadeOut.duration(140)}>
            <PressScale onPress={() => dropTime(v)} accessibilityRole="button" accessibilityLabel={t.pillsStep.removeTime(showTime(v))} style={styles.cap}>
              <Text style={styles.capText}>{showTime(v)}</Text>
              <Text style={styles.capX}>✕</Text>
            </PressScale>
          </Animated.View>
        ))}
      </Animated.View>
      {/* The wheels, and the button that adds their time */}
      <View style={styles.wheels}>
        <View style={styles.wheel}>
          <WheelPicker options={HOURS} value={hour} onChange={setHour} label={t.visits.hour} itemHeight={52} fontSize={30} />
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.wheel}>
          <WheelPicker options={MINUTES} value={minute} onChange={setMinute} label={t.visits.minute} itemHeight={52} fontSize={30} />
        </View>
        <PressScale onPress={addTime} accessibilityRole="button" accessibilityLabel={`${t.pillsStep.addTime}: ${showTime(`${hour}:${minute}`)}`} style={[styles.addTime, times.length >= MAX_TIMES && styles.addTimeOff]}>
          <Text style={styles.addTimeText}>+</Text>
        </PressScale>
      </View>
      <Text style={styles.note}>{from === 'settings' ? t.pillsStep.everyDay : t.pillsStep.everyDayLater}</Text>

      <BigButton
        scale="family"
        variant="outline"
        label={saving ? t.common.saving : t.pillsStep.add}
        onPress={canAdd ? add : undefined}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  pillText: {
    flex: 1,
    gap: 2,
  },
  pillName: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  pillTimes: {
    fontSize: family.fontSize.note,
    color: colors.ink,
  },
  remove: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  caps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cap: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 14, borderRadius: 22, backgroundColor: colors.ink },
  capText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent, fontVariant: ['tabular-nums'] },
  capX: { fontSize: 12, fontWeight: fontWeight.bold, color: 'rgba(255,255,255,0.55)' },
  wheels: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wheel: { flex: 1 },
  colon: { fontSize: 30, fontWeight: fontWeight.bold, color: colors.ink, marginBottom: 4 },
  addTime: { width: 56, height: 56, marginLeft: 8, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  addTimeOff: { opacity: 0.3 },
  addTimeText: { fontSize: 28, lineHeight: 30, fontWeight: fontWeight.bold, color: colors.onAccent },
  label: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.error,
    fontWeight: '600',
  },
});
