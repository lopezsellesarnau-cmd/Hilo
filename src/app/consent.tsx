import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide } from '@/lib/layout';
import { askForReminders } from '@/lib/reminders';
import { supabase } from '@/lib/supabase';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Bump when the text below changes, so people accept the new version. */
const CONSENT_VERSION = '2026-10-v1';
const KINDS = ['terms', 'voice_recording', 'life_story', 'health_data'] as const;

const POINTS = t.consent.points;

/**
 * The senior gives their own consent on their own phone, right after pairing.
 * A family member cannot consent for another adult (GDPR).
 */
export default function ConsentScreen() {
  // iPad on its side: the bot on the left, the text and buttons on the right
  const wide = useWide();
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
      : await supabase
          .from('consents')
          .insert(KINDS.map((kind) => ({ family_id: me.family_id, person_id: personId, kind, version: CONSENT_VERSION })));
    setSaving(false);
    if (e) {
      setError(t.common.saveFailed);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <WideFrame mood="speaking">
          <View style={styles.screen}>
            <View style={styles.center}>
              {wide ? null : (
                <View style={styles.doneBot}>
                  <Bot size={200} mood="speaking" />
                </View>
              )}
              <Text style={styles.doneTitle} accessibilityRole="header">
                {t.consent.doneTitle}
              </Text>
              <Text style={styles.doneText}>{t.consent.doneText}</Text>
            </View>
            <BigButton
              label={t.consent.start}
              onPress={async () => {
                // The screen just promised "Hilo te avisará": ask for notifications now, when it makes sense
                await askForReminders();
                router.replace('/home');
              }}
            />
          </View>
        </WideFrame>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <WideFrame mood={saving ? 'thinking' : 'idle'}>
        <ScrollView contentContainerStyle={styles.screen}>
          {wide ? null : (
            <View style={styles.bot}>
              <Bot size={96} mood={saving ? 'thinking' : 'idle'} />
            </View>
          )}
          <ScreenHeader title={t.consent.title} subtitle={t.consent.subtitle} />

          <View style={styles.points}>
            {POINTS.map((p) => (
              <View key={p} style={styles.point}>
                <View style={styles.dot} />
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </View>

          {declined ? (
            <Text style={styles.note}>{t.consent.declined}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.footer}>
            <BigButton label={saving ? t.common.saving : t.consent.agree} onPress={saving ? undefined : accept} />
            <BigButton variant="outline" label={t.consent.notNow} onPress={() => setDeclined(true)} />
          </View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
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
