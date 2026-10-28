import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { nextFamilyRoute } from '@/lib/onboarding';
import { getCaptchaToken } from '@/lib/captcha';
import { isReviewEmail } from '@/lib/review';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

export default function CodeStep() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  // App Store review account: a password instead of the emailed code
  const review = isReviewEmail(email);
  const ready = review ? code.length >= 8 : code.length === 6;

  const verify = async (token: string) => {
    setChecking(true);
    setMessage(null);
    const { data, error } = review
      ? await supabase.auth.signInWithPassword({
          email,
          password: token,
          options: { captchaToken: await getCaptchaToken() },
        })
      : await supabase.auth.verifyOtp({ email, token, type: 'email' });
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, captchaToken: await getCaptchaToken() },
    });
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
          onPress={ready && !checking ? () => verify(code) : undefined}
        />
      }>
      {review ? (
        <TextField
          label={t.code.label}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setMessage(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={ready ? () => verify(code) : undefined}
          autoFocus
        />
      ) : (
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
      )}
      {message ? <Text style={[styles.message, message.error && styles.error]}>{message.text}</Text> : null}
      {review ? null : (
        <Pressable onPress={resend} accessibilityRole="button" hitSlop={8} style={styles.resend}>
          <Text style={styles.resendText}>{t.code.resend}</Text>
        </Pressable>
      )}
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
