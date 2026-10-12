import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Bump when the text below changes, so people accept the new version. */
const CONSENT_VERSION = '2026-10-v1';
const KINDS = ['terms', 'voice_recording', 'life_story', 'health_data'] as const;

const POINTS = [
  'Guarda tu voz y lo que cuentas en las charlas, para escribir tu libro.',
  'Guarda cuándo tomas tus pastillas, para avisar a tu familia si se te olvida.',
  'Solo lo ve tu familia. No lo vendemos a nadie.',
  'Puedes pedir que se borre todo cuando quieras.',
];

/**
 * The senior gives their own consent on their own phone, right after pairing.
 * A family member cannot consent for another adult (GDPR).
 */
export default function ConsentScreen() {
  const { personId = '' } = useLocalSearchParams<{ personId: string }>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const { data: me, error: meError } = await supabase.from('people').select('family_id').eq('id', personId).single();
    const { error: e } = meError
      ? { error: meError }
      : await supabase.from('consents').insert(
          KINDS.map((kind) => ({ family_id: me.family_id, person_id: personId, kind, version: CONSENT_VERSION })),
        );
    setSaving(false);
    if (e) {
      setError('No se ha podido guardar. Prueba otra vez en un momento.');
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.screen}>
          <View style={styles.center}>
            <View style={styles.doneBot}>
              <Bot size={200} mood="speaking" />
            </View>
            <Text style={styles.doneTitle} accessibilityRole="header">
              ¡Todo listo!
            </Text>
            <Text style={styles.doneText}>Cada día, Hilo te avisará para charlar un rato.</Text>
          </View>
          <BigButton label="Empezar" onPress={() => router.replace('/home')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.bot}>
          <Bot size={96} mood={saving ? 'thinking' : 'idle'} />
        </View>
        <ScreenHeader title="Antes de empezar" subtitle="Esto es lo que hace Hilo con lo que le cuentas." />

        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <View style={styles.dot} />
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>

        {declined ? (
          <Text style={styles.note}>Sin tu permiso, Hilo no puede funcionar. Puedes hablarlo con tu familia y volver aquí.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          <BigButton label={saving ? 'Guardando…' : 'Estoy de acuerdo'} onPress={saving ? undefined : accept} />
          <BigButton variant="outline" label="Ahora no" onPress={() => setDeclined(true)} />
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  bot: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  doneBot: {
    flexShrink: 0,
    alignSelf: 'center',
    marginBottom: 20,
  },
  points: {
    marginTop: 24,
    gap: 18,
  },
  point: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    flexShrink: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.sage,
    marginTop: 9,
  },
  pointText: {
    flex: 1,
    fontSize: fontSize.talk,
    lineHeight: 30,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  note: {
    marginTop: 22,
    fontSize: fontSize.label,
    lineHeight: 26,
    color: colors.muted,
  },
  error: {
    marginTop: 22,
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    gap: spacing.buttonGap,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  doneTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
    textAlign: 'center',
  },
  doneText: {
    fontSize: fontSize.subtitle,
    lineHeight: 34,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
});
