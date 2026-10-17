import { router } from 'expo-router';
import { useState } from 'react';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';

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
      question={t.name.question}
      hint={t.name.hint}
      footer={<BigButton scale="family" label={t.common.continue} onPress={ready ? next : undefined} />}>
      <TextField
        label={t.name.label}
        value={name}
        onChangeText={setName}
        placeholder={t.name.placeholder}
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
