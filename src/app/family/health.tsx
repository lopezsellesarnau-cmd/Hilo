import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LockIcon } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { loadTodayDoses } from '@/components/today-pills';
import { type WeightPoint } from '@/components/weight-chart';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { showTime, type Dose } from '@/lib/time';
import { colors, fontWeight } from '@/theme';

/**
 * Salud (v2): the folder for her health. A grid that opens like the StackD Image accordion:
 * press a block and it takes its row, the row grows, the other row folds down to one line.
 * Pills and weight are real; documents and visits come next (see the vault plan).
 */

type Senior = { id: string; family_id: string; timezone: string };
type BlockId = 'pills' | 'weight' | 'docs' | 'visits';

export default function HealthScreen() {
  const text = t.health;
  const reduce = useReducedMotion();
  const [, setSenior] = useState<Senior | null>(null);
  const [doses, setDoses] = useState<Dose[] | null>(null);
  const [weights, setWeights] = useState<WeightPoint[]>([]);
  const [open, setOpen] = useState<BlockId | null>(null);

  const load = useCallback(async () => {
    const { data: s } = await supabase.from('people').select('id, family_id, timezone').eq('role', 'senior').limit(1).maybeSingle();
    if (!s) return;
    setSenior(s as Senior);
    const [d, { data: w }] = await Promise.all([
      loadTodayDoses(s.id, s.timezone).catch(() => null),
      supabase.from('weights').select('kg, measured_at').eq('person_id', s.id).order('measured_at', { ascending: false }).limit(400),
    ]);
    setDoses(d);
    const list = (w ?? []).map((r) => ({ kg: Number(r.kg), at: r.measured_at as string }));
    setWeights(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  const taken = doses?.filter((d) => d.takenAt).length ?? 0;
  const last = weights[0];

  const blocks: Record<BlockId, { small: string; big: string; dark?: boolean; soon?: boolean; detail?: ReactNode; go?: () => void }> = {
    pills: {
      small: text.pills,
      big: doses?.length ? `${taken}/${doses.length}` : '–',
      dark: true,
      detail: doses?.length ? (
        doses.map((d) => (
          <View key={d.key} style={styles.doseRow}>
            <View style={styles.doseText}>
              <Text style={[styles.doseName, styles.onInk]} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.doseTime}>{showTime(d.time)}</Text>
            </View>
            <View style={[styles.cap, d.takenAt ? styles.capOn : styles.capOff]} />
          </View>
        ))
      ) : (
        <Text style={[styles.doseTime, styles.pad]}>{text.pillsNone}</Text>
      ),
    },
    weight: {
      small: text.weight,
      big: last ? String(last.kg).replace('.', ',') : '–',
      // its own white page, like the frame "6 · Weight"
      go: () => router.push('/weight'),
    },
    docs: { small: text.docs, big: text.soon, soon: true },
    visits: { small: text.visits, big: text.soon, soon: true },
  };
  const ROWS: BlockId[][] = [
    ['pills', 'weight'],
    ['docs', 'visits'],
  ];
  const openRow = ROWS.findIndex((r) => r.includes(open as BlockId));
  const layout = reduce ? undefined : LinearTransition.springify().damping(16).stiffness(280).mass(0.8);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            <View accessible accessibilityLabel={text.locked}>
              <LockIcon />
            </View>
          </View>

          <View style={styles.grid}>
            {ROWS.map((row, r) => {
              const tall = openRow === r;
              const fold = openRow >= 0 && !tall;
              return (
                <Animated.View key={r} layout={layout} style={[styles.row, fold && styles.rowFold]}>
                  {row.map((id) => {
                    const b = blocks[id];
                    const me = open === id;
                    if (tall && !me) return null; // the open block takes the whole row
                    return (
                      <Animated.View key={id} layout={layout} style={styles.cell}>
                        {me ? (
                          // open: only the header closes it, so the tape and the tabs inside get their touches
                          <View style={[styles.block, styles.blockOpen, b.dark && styles.dark]}>
                            <View style={styles.openHead}>
                              <Text style={[styles.small, b.dark && styles.smallDark]}>{b.small}</Text>
                              <PressScale onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel={t.common.close} hitSlop={10} style={[styles.close, b.dark && styles.closeDark]}>
                                <Text style={[styles.closeText, b.dark && styles.onInk]}>✕</Text>
                              </PressScale>
                            </View>
                            <Animated.View entering={reduce ? undefined : FadeIn.delay(120).duration(220)} style={styles.detail}>
                              {b.detail}
                            </Animated.View>
                          </View>
                        ) : (
                          <PressScale
                            onPress={b.soon ? undefined : b.go ?? (() => setOpen(id))}
                            disabled={b.soon}
                            accessibilityRole="button"
                            accessibilityLabel={`${b.small}: ${b.big}`}
                            accessibilityState={{ expanded: false }}
                            style={[styles.block, fold && styles.blockFold, b.dark && styles.dark]}>
                            <View style={fold ? styles.foldLine : undefined}>
                              <Text style={[styles.small, b.dark && styles.smallDark]}>{b.small}</Text>
                              <Text style={[b.soon ? styles.soon : fold ? styles.bigFold : styles.big, b.dark && styles.onInk]} numberOfLines={1} adjustsFontSizeToFit>
                                {b.big}
                              </Text>
                            </View>
                          </PressScale>
                        )}
                      </Animated.View>
                    );
                  })}
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  closeDark: { backgroundColor: 'rgba(255,255,255,0.14)' },
  closeText: { fontSize: 15, fontWeight: fontWeight.bold, color: colors.ink },
  title: { fontSize: 48, fontWeight: fontWeight.bold, letterSpacing: -2, color: colors.ink },
  locked: { marginTop: 6, fontSize: 15, color: colors.muted },
  grid: { marginTop: 28, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  rowFold: {},
  cell: { flex: 1 },
  block: { minHeight: 178, borderRadius: 30, padding: 20, justifyContent: 'space-between', backgroundColor: colors.surface },
  blockFold: { minHeight: 72, paddingVertical: 0, justifyContent: 'center' },
  blockOpen: { justifyContent: 'flex-start' },
  dark: { backgroundColor: colors.ink },
  foldLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  small: { fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted },
  smallDark: { color: 'rgba(255,255,255,0.55)' },
  big: { marginTop: 70, fontSize: 56, fontWeight: fontWeight.bold, letterSpacing: -2.5, color: colors.ink },
  bigFold: { fontSize: 28, fontWeight: fontWeight.bold, letterSpacing: -1, color: colors.ink },
  onInk: { color: colors.onAccent },
  soon: { marginTop: 70, fontSize: 22, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: 'rgba(0,0,0,0.25)' },
  detail: { marginTop: 14 },
  pad: { paddingVertical: 12 },
  doseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' },
  doseText: { flex: 1, paddingRight: 12 },
  doseName: { fontSize: 22, fontWeight: fontWeight.bold, letterSpacing: -0.6 },
  doseTime: { marginTop: 2, fontSize: 15, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.55)' },
  cap: { width: 44, height: 24, borderRadius: 12 },
  capOn: { backgroundColor: colors.onAccent },
  capOff: { borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)' },
  weightDetail: { gap: 16 },
  kg: { fontSize: 96, lineHeight: 96, fontWeight: fontWeight.bold, letterSpacing: -3.5, color: colors.ink, fontVariant: ['tabular-nums'] },
  kgUnit: { fontSize: 24, letterSpacing: 0, color: 'rgba(0,0,0,0.3)' },
  tape: { marginTop: 4 },
  save: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  saving: { opacity: 0.5 },
  saveText: { fontSize: 17, fontWeight: fontWeight.bold, color: colors.onAccent },
});
