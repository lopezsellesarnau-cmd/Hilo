import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AgreeBox } from '@/components/agree-box';
import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
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
      setError('Para seguir, marca que aceptas los Términos.');
      return;
    }
    if (!looksLikeEmail(email)) {
      setError('Revisa el email: parece que falta algo.');
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
          ? 'Hemos enviado demasiados códigos seguidos. Espera unos minutos y vuelve a probar.'
          : 'No hemos podido enviar el código. Comprueba tu conexión y vuelve a probar.',
      );
      return;
    }
    router.push({ pathname: '/onboarding/code', params: { email: email.trim().toLowerCase() } });
  };

  return (
    <OnboardingStep
      step={1}
      mood={sending ? 'thinking' : 'idle'}
      question="¿Cuál es tu email?"
      hint="Te enviamos un código de 6 cifras. Sin contraseñas."
      footer={
        <BigButton scale="family" label={sending ? 'Enviando…' : 'Enviar código'} onPress={sending ? undefined : send} />
      }>
      <TextField
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
        }}
        placeholder="laura@email.com"
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
