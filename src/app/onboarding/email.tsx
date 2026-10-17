import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AgreeBox } from '@/components/agree-box';
import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { family } from '@/theme';

const looksLikeEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());

export default function EmailStep() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const send = async () => {
    if (!agreed) {
      setError(t.email.mustAgree);
      return;
    }
    if (!looksLikeEmail(email)) {
      setError(t.email.invalid);
      return;
    }
    setSending(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (e) {
      setError(
        e.status === 429
          ? t.email.tooMany
          : t.email.sendFailed,
      );
      return;
    }
    router.push({ pathname: '/onboarding/code', params: { email: email.trim().toLowerCase() } });
  };

  return (
    <OnboardingStep
      step={1}
      mood={sending ? 'thinking' : 'idle'}
      question={t.email.question}
      hint={t.email.hint}
      footer={
        <BigButton scale="family" label={sending ? t.email.sending : t.email.send} onPress={sending ? undefined : send} />
      }>
      <TextField
        label={t.settings.email}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder={t.email.placeholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={send}
        autoFocus
      />
      <AgreeBox
        checked={agreed}
        onChange={(v) => {
          setAgreed(v);
          setError(null);
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
