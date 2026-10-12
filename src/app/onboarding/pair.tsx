import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

export default function PairStep() {
  const { seniorId = '', seniorName = '' } = useLocalSearchParams<{ seniorId: string; seniorName: string }>();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newCode = useCallback(() => {
    supabase.rpc('create_pairing_code', { senior_id: seniorId }).then(({ data, error: e }) => {
      if (e || !data) {
        setError('No hemos podido crear el código. Comprueba tu conexión y vuelve a probar.');
        return;
      }
      setError(null);
      setCode(data as string);
    });
  }, [seniorId]);

  useEffect(newCode, [newCode]);

  const done = () => {
    // TODO: family tabs (Hoy / Libro / Ajustes). Until then, Ajustes.
    // The onboarding is finished: clear it so "Atrás" cannot go back into it
    router.dismissAll();
    router.replace('/settings');
  };

  return (
    <OnboardingStep
      step={6}
      question={seniorName ? `Conecta el móvil de ${seniorName}` : 'Conecta su móvil'}
      hint="Ten su móvil a mano. Es un momento."
      footer={
        <>
          <BigButton scale="family" label="Ya está" onPress={done} />
          <BigButton scale="family" variant="outline" label="Lo haré luego" onPress={done} />
        </>
      }>
      <View style={styles.steps}>
        <Text style={styles.step}>1. En su móvil, instala Hilo desde la App Store.</Text>
        <Text style={styles.step}>2. Abre Hilo y toca «Tengo un código».</Text>
        <Text style={styles.step}>3. Escribe este código:</Text>
      </View>

      <View style={styles.codeBox} accessible accessibilityLabel={code ? `Código ${code.split('').join(' ')}` : 'Creando código'}>
        <Text style={styles.code}>{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '··· ···'}</Text>
      </View>
      <Text style={styles.note}>Caduca en 30 minutos y solo sirve una vez.</Text>

      <Pressable onPress={newCode} accessibilityRole="button" hitSlop={8} style={styles.again}>
        <Text style={styles.againText}>Crear otro código</Text>
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
