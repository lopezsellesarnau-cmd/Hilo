import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressScale } from '@/components/press-scale';
import { toast } from '@/components/toast';
import { inRange, WeightChart, type Range, type WeightPoint } from '@/components/weight-chart';
import { WeightTape } from '@/components/weight-tape';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, fontWeight } from '@/theme';

type Senior = { id: string; family_id: string };

/**
 * Peso (v2, frame "6 · Weight"): her weight, on a white page. A giant number, how it moved,
 * the 1M / 3M / 1Y line, and the StackD tape to log today's weight.
 */
export default function WeightScreen() {
  const text = t.health;
  const [senior, setSenior] = useState<Senior | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [range, setRange] = useState<Range>('m3');
  const [kg, setKg] = useState(65);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { data: s } = await supabase.from('people').select('id, family_id').eq('role', 'senior').limit(1).maybeSingle();
        if (!s) return;
        setSenior(s as Senior);
        const { data: w } = await supabase.from('weights').select('kg, measured_at').eq('person_id', s.id).order('measured_at', { ascending: false }).limit(400);
        const list = (w ?? []).map((r) => ({ kg: Number(r.kg), at: r.measured_at as string }));
        setWeights(list);
        if (list[0]) setKg(list[0].kg);
      })().catch(() => {});
    }, []),
  );

  const save = async () => {
    if (!senior || saving) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data: me } = await supabase.from('people').select('id').eq('user_id', auth.user?.id ?? '').maybeSingle();
    const { error } = await supabase.from('weights').insert({ family_id: senior.family_id, person_id: senior.id, kg, added_by: me?.id ?? null });
    setSaving(false);
    if (error) return toast.error(t.common.saveFailed);
    toast(text.weightSaved);
    setWeights((w) => [{ kg, at: new Date().toISOString() }, ...w]);
  };

  // How it moved over the range shown: "−0,9 kg since 25 Aug"
  const shown = inRange(weights, range);
  const delta = shown.length >= 2 ? shown[shown.length - 1].kg - shown[0].kg : null;
  const since = shown[0] ? new Date(shown[0].at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={12} style={styles.back}>
            <Text style={styles.backText}>‹ {text.title}</Text>
          </Pressable>

          <View style={styles.numberRow} accessible accessibilityLabel={`${kg.toFixed(1)} kg`}>
            <Text style={styles.number} numberOfLines={1}>
              {kg.toFixed(1).replace('.', ',')}
            </Text>
            <Text style={styles.unit}>kg</Text>
          </View>
          {delta !== null ? (
            <Text style={styles.delta}>{text.since(`${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta).toFixed(1).replace('.', ',')}`, since)}</Text>
          ) : null}

          <View style={styles.chart}>
            <WeightChart points={weights} range={range} onRange={setRange} labels={text.ranges} today={text.todayShort} empty={text.weightEmpty} />
          </View>

          <View style={styles.tape}>
            <WeightTape value={kg} onChange={setKg} label={text.weightLabel} />
          </View>
          <PressScale onPress={save} accessibilityRole="button" style={[styles.save, saving && styles.saving]}>
            <Text style={styles.saveText}>{text.saveWeight}</Text>
          </PressScale>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  back: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  numberRow: { marginTop: 18, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  number: { fontSize: 120, lineHeight: 120, fontWeight: fontWeight.bold, letterSpacing: -7, color: colors.ink, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 28, fontWeight: fontWeight.bold, color: 'rgba(0,0,0,0.3)' },
  delta: { marginTop: 6, fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  chart: { marginTop: 24 },
  tape: { marginTop: 24 },
  save: { marginTop: 16, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  saving: { opacity: 0.5 },
  saveText: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.onAccent },
});
