import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressScale } from '@/components/press-scale';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, fontWeight } from '@/theme';

/**
 * Salud (v2, step 1): the folder for her health. Bold blocks, one number each.
 * Pills are real; weight, documents and visits arrive in the next steps (see the vault plan).
 */
export default function HealthScreen() {
  const text = t.health;
  const [pills, setPills] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const { data: senior } = await supabase.from('people').select('id').eq('role', 'senior').limit(1).maybeSingle();
        if (!senior) return;
        const { count } = await supabase.from('medications').select('id', { count: 'exact', head: true }).eq('person_id', senior.id).eq('active', true);
        if (live) setPills(count ?? 0);
      })().catch(() => {});
      return () => {
        live = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.screen}>
          <Text style={styles.title} accessibilityRole="header">
            {text.title}
          </Text>
          <Text style={styles.locked}>{text.locked}</Text>

          <View style={styles.grid}>
            <View style={styles.row}>
              <Block small={text.pills} big={pills === null ? '–' : String(pills)} dark />
              <Block small={text.weight} big={text.soon} soon />
            </View>
            <View style={styles.row}>
              <Block small={text.docs} big={text.soon} soon />
              <Block small={text.visits} big={text.soon} soon />
            </View>
          </View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

function Block({ small, big, dark, soon }: { small: string; big: string; dark?: boolean; soon?: boolean }) {
  return (
    <PressScale containerStyle={styles.cell} style={[styles.block, dark && styles.blockDark]} accessibilityRole="button" accessibilityLabel={`${small}: ${big}`} disabled={soon}>
      <Text style={[styles.small, dark && styles.smallDark]}>{small}</Text>
      <Text style={[soon ? styles.soon : styles.big, dark && styles.bigDark]} numberOfLines={1} adjustsFontSizeToFit>
        {big}
      </Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 48, fontWeight: fontWeight.bold, letterSpacing: -2, color: colors.ink },
  locked: { marginTop: 6, fontSize: 15, color: colors.muted },
  grid: { marginTop: 28, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1 },
  block: { height: 178, borderRadius: 30, padding: 20, justifyContent: 'space-between', backgroundColor: colors.surface },
  blockDark: { backgroundColor: colors.ink },
  small: { fontSize: 15, fontWeight: fontWeight.semibold, color: colors.muted },
  smallDark: { color: 'rgba(255,255,255,0.55)' },
  big: { fontSize: 56, fontWeight: fontWeight.bold, letterSpacing: -2.5, color: colors.ink },
  bigDark: { color: colors.onAccent },
  soon: { fontSize: 22, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: 'rgba(0,0,0,0.25)' },
});
