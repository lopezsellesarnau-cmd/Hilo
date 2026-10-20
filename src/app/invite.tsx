import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { t } from '@/i18n';
import { createInvite, inviteLink, showInviteCode } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

const text = t.invite;

/**
 * "Invitar a la familia": a code (and its QR) for a brother, a daughter or a grandson.
 * Together in the same room they scan the QR; far away, the code goes by WhatsApp with "Enviar".
 */
export default function InviteScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Inviting is part of the Familia plan: on Básico, this screen offers the upgrade instead
  const [needsPlan, setNeedsPlan] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [seniorName, setSeniorName] = useState('');

  const newCode = useCallback(() => {
    createInvite()
      .then((c) => {
        setError(null);
        setCode(c);
      })
      .catch((e: Error) => (e.message === 'plan' ? setNeedsPlan(true) : setError(text.createFailed)));
  }, []);

  useEffect(newCode, [newCode]);

  // Who is already in, so they don't invite someone twice
  useEffect(() => {
    supabase
      .from('people')
      .select('role, display_name')
      .order('created_at')
      .then(({ data }) => {
        setMembers((data ?? []).filter((p) => p.role === 'member').map((p) => p.display_name));
        setSeniorName(data?.find((p) => p.role === 'senior')?.display_name ?? '');
      });
  }, []);

  const send = () => code && Share.share({ message: text.message(seniorName, showInviteCode(code)) });

  if (needsPlan) {
    return (
      <OnboardingStep
        question={text.title}
        hint={text.planOnly}
        footer={<BigButton scale="family" label={text.seePlan} onPress={() => router.push('/paywall')} />}>
        {members.length ? <Text style={styles.note}>{text.already(members.join(', '))}</Text> : null}
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      question={text.title}
      hint={text.hint(seniorName)}
      footer={<BigButton scale="family" label={text.send} onPress={code ? send : undefined} />}>
      <View style={styles.steps}>
        <Text style={styles.step}>{text.step1}</Text>
        <Text style={styles.step}>{text.step2}</Text>
        <Text style={styles.step}>{text.step3}</Text>
      </View>

      <View style={styles.qr} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {code ? <QRCode value={inviteLink(code)} size={176} color={colors.ink} backgroundColor={colors.background} /> : null}
      </View>

      <View
        style={styles.codeBox}
        accessible
        accessibilityLabel={code ? t.pair.codeA11y(code.split('').join(' ')) : t.pair.creating}>
        <Text style={styles.code}>{code ? showInviteCode(code) : '···· ····'}</Text>
      </View>
      <Text style={styles.note}>{text.expires}</Text>

      <Pressable onPress={newCode} accessibilityRole="button" hitSlop={8} style={styles.again}>
        <Text style={styles.againText}>{t.pair.again}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {members.length ? <Text style={styles.note}>{text.already(members.join(', '))}</Text> : null}
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
    backgroundColor: colors.accentSoft,
    marginTop: 8,
  },
  code: {
    fontSize: 40,
    fontWeight: fontWeight.heavy,
    letterSpacing: 4,
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
