import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { t } from '@/i18n';
import { pairingLink } from '@/lib/pairing';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

export default function PairStep() {
  const { seniorId = '', seniorName = '' } = useLocalSearchParams<{ seniorId: string; seniorName: string }>();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newCode = useCallback(() => {
    supabase.rpc('create_pairing_code', { senior_id: seniorId }).then(({ data, error: e }) => {
      if (e || !data) {
        setError(t.pair.createFailed);
        return;
      }
      setError(null);
      setCode(data as string);
    });
  }, [seniorId]);

  useEffect(newCode, [newCode]);

  const done = () => {
    // The onboarding is finished (or this came from Hoy): clear it so "Atrás" cannot go back into it
    router.dismissAll();
    router.replace('/family/today');
  };

  return (
    <OnboardingStep
      step={6}
      question={t.pair.question(seniorName)}
      hint={t.pair.hint}
      footer={
        <>
          <BigButton scale="family" label={t.pair.done} onPress={done} />
          <BigButton scale="family" variant="outline" label={t.common.later} onPress={done} />
        </>
      }>
      <View style={styles.steps}>
        <Text style={styles.step}>{t.pair.step1}</Text>
        <Text style={styles.step}>{t.pair.step2}</Text>
        <Text style={styles.step}>{t.pair.step3}</Text>
      </View>

      <View style={styles.qr} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {code ? <QRCode value={pairingLink(code)} size={176} color={colors.ink} backgroundColor={colors.background} /> : null}
      </View>

      <View style={styles.codeBox} accessible accessibilityLabel={code ? t.pair.codeA11y(code.split('').join(' ')) : t.pair.creating}>
        <Text style={styles.code}>{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}</Text>
      </View>
      <Text style={styles.note}>{t.pair.expires}</Text>

      <Pressable onPress={newCode} accessibilityRole="button" hitSlop={8} style={styles.again}>
        <Text style={styles.againText}>{t.pair.again}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  steps: {
    gap: 8,
  },
  step: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.ink,
  },
  // Fixed size, also while the code is being created, so nothing jumps
  qr: {
    flexShrink: 0,
    alignSelf: 'center',
    width: 176,
    height: 176,
    marginTop: 8,
  },
  codeBox: {
    flexShrink: 0,
    alignItems: 'center',
    paddingVertical: 22,
    borderRadius: 20,
    backgroundColor: colors.sageSoft,
    marginTop: 8,
  },
  code: {
    fontSize: 44,
    fontWeight: fontWeight.heavy,
    letterSpacing: 6,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
  },
  again: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  againText: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
