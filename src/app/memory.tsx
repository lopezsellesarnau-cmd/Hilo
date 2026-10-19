import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, family } from '@/theme';

const text = t.memory;
/** Same limit as the column (people.memory) */
const MAX = 2000;

/**
 * "Lo que Hilo recuerda": the short notes Hilo keeps between talks, which the family can read and correct.
 * Hilo rewrites them after each talk starting from what is here, so a correction stays.
 */
export default function MemoryScreen() {
  const { seniorId = '', seniorName = '' } = useLocalSearchParams<{ seniorId: string; seniorName: string }>();
  const [notes, setNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('people')
      .select('memory')
      .eq('id', seniorId)
      .single()
      .then(({ data, error: e }) => {
        if (e) return setError(t.common.loadFailed);
        setNotes(data?.memory ?? '');
      });
  }, [seniorId]);

  const save = async () => {
    if (saving || notes === null) return;
    setSaving(true);
    setError(null);
    const value = notes.trim();
    const { error: e } = await supabase
      .from('people')
      .update({ memory: value || null })
      .eq('id', seniorId);
    setSaving(false);
    if (e) return setError(t.common.saveFailed);
    router.back();
  };

  return (
    <OnboardingStep
      mood={saving ? 'thinking' : 'idle'}
      question={text.title(seniorName)}
      hint={text.hint}
      footer={<BigButton scale="family" label={saving ? t.common.saving : t.common.save} onPress={notes === null ? undefined : save} />}>
      {notes !== null ? (
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={MAX}
          placeholder={text.empty}
          placeholderTextColor="#9a9a9a"
          accessibilityLabel={text.title(seniorName)}
          style={styles.notes}
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  notes: {
    minHeight: 220,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
