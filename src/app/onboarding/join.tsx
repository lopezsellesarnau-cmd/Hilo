import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { getPendingInvite, JOIN_MESSAGES, joinFamily, setPendingInvite } from '@/lib/invite';
import { family } from '@/theme';

const text = t.join;

/** Someone invited by their family types the 8 digits (or scans the QR) and joins that family. */
export default function JoinStep() {
  const { memberName = '' } = useLocalSearchParams<{ memberName: string }>();
  // Filled in when they came from an invite QR scanned with the Camera (see app/join.tsx)
  const [code, setCode] = useState(() => getPendingInvite() ?? '');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: string) => {
    if (joining) return;
    setJoining(true);
    setError(null);
    try {
      await joinFamily(value, memberName);
    } catch (e) {
      setJoining(false);
      setError(JOIN_MESSAGES[(e as Error).message] ?? JOIN_MESSAGES.offline);
      return;
    }
    setPendingInvite(null);
    // Their senior is already set up: straight to the family app, with nothing to go back to
    router.dismissAll();
    router.replace('/family/today');
  };

  return (
    <OnboardingStep
      mood={joining ? 'thinking' : 'idle'}
      question={text.question}
      hint={text.hint}
      footer={
        <>
          <BigButton
            scale="family"
            label={joining ? text.joining : text.join}
            onPress={code.length === 8 && !joining ? () => submit(code) : undefined}
          />
          {/* No camera scan in the browser: the 8 digits are enough */}
          {Platform.OS === 'web' ? null : (
            <BigButton
              scale="family"
              variant="outline"
              label={t.pairCode.scan}
              onPress={() => router.push({ pathname: '/pair-scan', params: { mode: 'join', memberName } })}
            />
          )}
        </>
      }>
      <TextField
        label={text.label}
        code
        value={code}
        onChangeText={(v) => {
          const digits = v.replace(/\D/g, '').slice(0, 8);
          setCode(digits);
          setError(null);
          if (digits.length === 8) submit(digits);
        }}
        placeholder="········"
        keyboardType="number-pad"
        maxLength={8}
        autoFocus
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
