import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { nextFamilyRoute } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

export default function CodeStep() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const verify = async (token: string) => {
    setChecking(true);
    setMessage(null);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error || !data.user) {
      setChecking(false);
      setMessage({ text: t.code.wrong, error: true });
      return;
    }
    // Someone coming back continues where they left off
    const next = await nextFamilyRoute(data.user.id);
    setChecking(false);
    // Nothing to go back to: Welcome and the email step are done
    router.dismissAll();
    router.replace(next);
  };

  const resend = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setMessage(
      error
        ? { text: t.code.wait, error: true }
        : { text: t.code.resent, error: false },
    );
  };

  return (
    <OnboardingStep
      step={1}
      mood={checking ? 'thinking' : 'idle'}
      question={t.code.question}
      hint={
        <>
          {t.code.sentTo}
          <Text style={styles.strong}>{email}</Text>
          {t.code.checkSpam}
        </>
      }
      footer={
        <BigButton
          scale="family"
          label={checking ? t.code.checking : t.common.continue}
          onPress={code.length === 6 && !checking ? () => verify(code) : undefined}
        />
      }>
      <TextField
        label={t.code.label}
        code
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          setMessage(null);
          if (digits.length === 6) verify(digits);
        }}
        placeholder="······"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
      />
      {message ? <Text style={[styles.message, message.error && styles.error]}>{message.text}</Text> : null}
      <Pressable onPress={resend} accessibilityRole="button" hitSlop={8} style={styles.resend}>
        <Text style={styles.resendText}>{t.code.resend}</Text>
      </Pressable>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  strong: {
    fontWeight: '700',
    color: colors.ink,
  },
  message: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    fontWeight: '600',
    color: colors.muted,
  },
  error: {
    color: '#b3261e',
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  resendText: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
