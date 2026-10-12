import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { family } from '@/theme';

/**
 * Creates the family (or reuses it if the user came back with "Atrás")
 * and adds the senior. The senior has no user_id until they pair their phone.
 */
async function saveFamily(memberName: string, seniorName: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data: me, error: meError } = await supabase
    .from('people')
    .select('family_id')
    .eq('user_id', user.id)
    .eq('role', 'member')
    .limit(1)
    .maybeSingle();
  if (meError) throw meError;

  let familyId: string | undefined = me?.family_id;
  if (!familyId) {
    const { data, error } = await supabase.rpc('create_family', {
      family_name: `Familia de ${seniorName}`,
      member_name: memberName,
    });
    if (error) throw error;
    familyId = data as string;
  }

  const { data: senior, error: seniorError } = await supabase
    .from('people')
    .select('id')
    .eq('family_id', familyId)
    .eq('role', 'senior')
    .limit(1)
    .maybeSingle();
  if (seniorError) throw seniorError;

  if (senior) {
    const { error } = await supabase.from('people').update({ display_name: seniorName }).eq('id', senior.id);
    if (error) throw error;
    return senior.id as string;
  }
  const { data: added, error } = await supabase
    .from('people')
    .insert({ family_id: familyId, role: 'senior', display_name: seniorName })
    .select('id')
    .single();
  if (error) throw error;
  return added.id as string;
}

export default function SeniorStep() {
  const { memberName = '' } = useLocalSearchParams<{ memberName: string }>();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = name.trim().length > 0 && !saving;

  const next = async () => {
    if (!ready) return;
    setSaving(true);
    setError(null);
    let seniorId: string;
    try {
      seniorId = await saveFamily(memberName, name.trim());
    } catch {
      setSaving(false);
      setError('No hemos podido guardarlo. Comprueba tu conexión y vuelve a probar.');
      return;
    }
    setSaving(false);
    router.push({ pathname: '/onboarding/talk', params: { seniorId, seniorName: name.trim() } });
  };

  return (
    <OnboardingStep
      step={3}
      question="¿Para quién es Hilo?"
      hint="Escribe su nombre como lo decís en casa. Hilo le hablará así cada día."
      footer={<BigButton scale="family" label={saving ? 'Guardando…' : 'Continuar'} onPress={ready ? next : undefined} />}>
      <TextField
        label="Su nombre"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Carmen"
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={60}
        returnKeyType="next"
        onSubmitEditing={next}
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
