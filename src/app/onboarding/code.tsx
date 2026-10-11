import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
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
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setChecking(false);
    if (error) {
      setMessage({ text: 'Ese código no es correcto o ha caducado. Revísalo o pide otro.', error: true });
      return;
    }
    // TODO next step: continue to "¿Cómo te llamas?"
    router.replace('/home');
  };

  const resend = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setMessage(
      error
        ? { text: 'Espera unos minutos antes de pedir otro código.', error: true }
        : { text: 'Te hemos enviado un código nuevo.', error: false },
    );
  };

  return (
    <OnboardingStep
      step={1}
      question="Escribe el código"
      hint={
        <>
          Lo hemos enviado a <Text style={styles.strong}>{email}</Text>. Mira también en correo no deseado.
        </>
      }
      footer={
        <BigButton
          scale="family"
          label={checking ? 'Comprobando…' : 'Continuar'}
          onPress={code.length === 6 && !checking ? () => verify(code) : undefined}
        />
      }>
      <TextField
        label="Código"
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
        <Text style={styles.resendText}>Enviar otro código</Text>
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
