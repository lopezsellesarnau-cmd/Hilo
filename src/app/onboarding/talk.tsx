import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { OnboardingStep } from '@/components/onboarding-step';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight } from '@/theme';

const TIMES = [
  { value: '09:00', label: '9:00' },
  { value: '10:00', label: '10:00' },
  { value: '11:00', label: '11:00' },
  { value: '12:00', label: '12:00' },
  { value: '17:00', label: '17:00' },
  { value: '18:00', label: '18:00' },
  { value: '19:00', label: '19:00' },
] as const;

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
] as const;

type Time = (typeof TIMES)[number]['value'];
type Language = (typeof LANGUAGES)[number]['value'];

// The family member's phone is usually in the same time zone as the senior.
// It can be changed later in Ajustes.
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

export default function TalkStep() {
  const { seniorId = '', seniorName = '', from = '' } = useLocalSearchParams<{
    seniorId: string;
    seniorName: string;
    /** 'settings' when opened from Ajustes to change it: load what is saved and go back after */
    from?: string;
  }>();
  const editing = from === 'settings';
  const [time, setTime] = useState<Time>('10:00');
  const [language, setLanguage] = useState<Language>('es');

  useEffect(() => {
    if (!editing) return;
    supabase
      .from('people')
      .select('talk_time, locale')
      .eq('id', seniorId)
      .single()
      .then(({ data }) => {
        const saved = TIMES.find((t) => t.value === data?.talk_time?.slice(0, 5));
        if (saved) setTime(saved.value);
        const savedLang = LANGUAGES.find((l) => l.value === data?.locale);
        if (savedLang) setLanguage(savedLang.value);
      });
  }, [editing, seniorId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    // When editing, the time zone stays: the family member may live somewhere else
    const { error: e } = await supabase
      .from('people')
      .update(editing ? { talk_time: time, locale: language } : { talk_time: time, locale: language, timezone: deviceTimezone })
      .eq('id', seniorId);
    setSaving(false);
    if (e) {
      setError(t.common.saveFailed);
      return;
    }
    if (editing) return router.back();
    router.push({ pathname: '/onboarding/pills', params: { seniorId, seniorName } });
  };

  return (
    <OnboardingStep
      step={editing ? undefined : 4}
      mood={saving ? 'thinking' : 'idle'}
      question={t.talkStep.question(seniorName)}
      hint={t.talkStep.hint}
      footer={
        <BigButton
          scale="family"
          label={saving ? t.common.saving : editing ? t.common.save : t.common.continue}
          onPress={saving ? undefined : next}
        />
      }>
      <Text style={styles.label}>{t.talkStep.timeLabel}</Text>
      <ChoiceChips label={t.talkStep.timeA11y} options={TIMES} value={time} onChange={setTime} />
      {editing ? null : <Text style={styles.note}>{t.talkStep.timezone(deviceTimezone)}</Text>}

      <Text style={[styles.label, styles.spaced]}>{t.talkStep.langLabel}</Text>
      <ChoiceChips label={t.talkStep.langA11y} options={LANGUAGES} value={language} onChange={setLanguage} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  spaced: {
    marginTop: 18,
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
