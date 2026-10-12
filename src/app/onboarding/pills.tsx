import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { MultiChoiceChips } from '@/components/choice-chips';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

const TIMES = [
  { value: '08:00', label: '8:00' },
  { value: '09:00', label: '9:00' },
  { value: '13:00', label: '13:00' },
  { value: '14:00', label: '14:00' },
  { value: '20:00', label: '20:00' },
  { value: '21:00', label: '21:00' },
  { value: '22:00', label: '22:00' },
] as const;

type Time = (typeof TIMES)[number]['value'];
type Medication = { id: string; name: string; times: string[] };

// Postgres returns '09:00:00'; show '9:00'
const showTime = (t: string) => t.slice(0, 5).replace(/^0/, '');

export default function PillsStep() {
  const { seniorId = '', seniorName = '', from = '' } = useLocalSearchParams<{
    seniorId: string;
    seniorName: string;
    /** 'today' when opened from Hoy: go back there instead of on to pairing */
    from?: string;
  }>();
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [pills, setPills] = useState<Medication[]>([]);
  const [name, setName] = useState('');
  const [times, setTimes] = useState<Time[]>(['09:00']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAdd = name.trim().length > 0 && times.length > 0 && familyId !== null && !saving;

  // Load what is already there, in case the user came back with "Atrás"
  useEffect(() => {
    supabase
      .from('people')
      .select('family_id, medications(id, name, times)')
      .eq('id', seniorId)
      .single()
      .then(({ data, error: e }) => {
        if (e || !data) {
          setError('No hemos podido cargar los datos. Comprueba tu conexión.');
          return;
        }
        setFamilyId(data.family_id);
        setPills((data.medications ?? []) as Medication[]);
      });
  }, [seniorId]);

  const add = async () => {
    if (!canAdd) return;
    setSaving(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('medications')
      .insert({ family_id: familyId, person_id: seniorId, name: name.trim(), times })
      .select('id, name, times')
      .single();
    setSaving(false);
    if (e || !data) {
      setError('No hemos podido guardarla. Comprueba tu conexión y vuelve a probar.');
      return;
    }
    setPills((p) => [...p, data as Medication]);
    setName('');
    setTimes(['09:00']);
  };

  const remove = async (id: string) => {
    setError(null);
    const { error: e } = await supabase.from('medications').delete().eq('id', id);
    if (e) {
      setError('No hemos podido quitarla. Vuelve a probar.');
      return;
    }
    setPills((p) => p.filter((x) => x.id !== id));
  };

  const next = () => {
    if (from === 'today') return router.back();
    router.push({ pathname: '/onboarding/pair', params: { seniorId, seniorName } });
  };

  return (
    <OnboardingStep
      step={5}
      mood={saving ? 'thinking' : 'idle'}
      question={`¿Qué pastillas toma ${seniorName || 'cada día'}?`}
      hint="Hilo se lo recordará a su hora y te avisará si se le olvida."
      footer={
        <BigButton
          scale="family"
          variant={pills.length ? 'fill' : 'outline'}
          label={pills.length ? 'Continuar' : 'Lo haré luego'}
          onPress={next}
        />
      }>
      {pills.map((p) => (
        <View key={p.id} style={styles.pill}>
          <View style={styles.pillText}>
            <Text style={styles.pillName}>{p.name}</Text>
            <Text style={styles.pillTimes}>{p.times.map(showTime).join(' · ')}</Text>
          </View>
          <Pressable
            onPress={() => remove(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${p.name}`}
            hitSlop={10}>
            <Text style={styles.remove}>Quitar</Text>
          </Pressable>
        </View>
      ))}

      <TextField
        label="Nombre de la pastilla"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="La de la tensión"
        autoCapitalize="sentences"
        maxLength={80}
        returnKeyType="done"
      />
      <Text style={styles.label}>A QUÉ HORA</Text>
      <MultiChoiceChips label="Horas de la pastilla" options={TIMES} value={times} onChange={setTimes} />
      <Text style={styles.note}>Todos los días. Puedes cambiarlo luego en Ajustes.</Text>

      <BigButton
        scale="family"
        variant="outline"
        label={saving ? 'Guardando…' : 'Añadir pastilla'}
        onPress={canAdd ? add : undefined}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.sageSoft,
  },
  pillText: {
    flex: 1,
    gap: 2,
  },
  pillName: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  pillTimes: {
    fontSize: family.fontSize.note,
    color: colors.ink,
  },
  remove: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: '#b3261e',
    fontWeight: '600',
  },
});
