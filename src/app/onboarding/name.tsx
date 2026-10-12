import { router } from 'expo-router';
import { useState } from 'react';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';

export default function NameStep() {
  const [name, setName] = useState('');
  const ready = name.trim().length > 0;

  const next = () => {
    if (!ready) return;
    router.push({ pathname: '/onboarding/senior', params: { memberName: name.trim() } });
  };

  return (
    <OnboardingStep
      step={2}
      question="¿Cómo te llamas?"
      hint="Así aparecerás en Hilo para el resto de la familia."
      footer={<BigButton scale="family" label="Continuar" onPress={ready ? next : undefined} />}>
      <TextField
        label="Tu nombre"
        value={name}
        onChangeText={setName}
        placeholder="Laura"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={60}
        returnKeyType="next"
        onSubmitEditing={next}
        autoFocus
      />
    </OnboardingStep>
  );
}
