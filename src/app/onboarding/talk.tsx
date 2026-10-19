import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BigButton } from '@/components/big-button';
import { ChoiceChips } from '@/components/choice-chips';
import { OnboardingStep } from '@/components/onboarding-step';
import { TextField } from '@/components/text-field';
import { t } from '@/i18n';
import { findPlace, type Place } from '@/lib/place';
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
  // Her town: typed by the family, looked up once, saved with its coordinates for the weather
  const [town, setTown] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [placeState, setPlaceState] = useState<'idle' | 'searching' | 'notFound'>('idle');
  // Leaving the field and tapping Save both look it up: the second one waits for the first
  const searching = useRef<Promise<Place | null | 'notFound'> | null>(null);

  useEffect(() => {
    if (!editing) return;
    supabase
      .from('people')
      .select('talk_time, locale, city, latitude, longitude, country_code, region_code')
      .eq('id', seniorId)
      .single()
      .then(({ data }) => {
        const saved = TIMES.find((t) => t.value === data?.talk_time?.slice(0, 5));
        if (saved) setTime(saved.value);
        const savedLang = LANGUAGES.find((l) => l.value === data?.locale);
        if (savedLang) setLanguage(savedLang.value);
        if (data?.city && data.latitude != null && data.longitude != null && data.country_code) {
          setTown(data.city);
          setPlace({
            city: data.city,
            label: data.city,
            latitude: data.latitude,
            longitude: data.longitude,
            country_code: data.country_code,
            region_code: data.region_code,
          });
        }
      });
  }, [editing, seniorId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Looks the town up unless it is the one already found. Null when the field is empty. */
  const lookUp = (): Promise<Place | null | 'notFound'> => {
    const query = town.trim();
    if (!query) return Promise.resolve(null);
    if (place && query === place.city) return Promise.resolve(place);
    if (searching.current) return searching.current;
    setPlaceState('searching');
    searching.current = findPlace(query, language).then((found) => {
      searching.current = null;
      setPlace(found);
      setPlaceState(found ? 'idle' : 'notFound');
      // "alcoy" or "amstedam" become the town's real name, so the family sees what was found
      if (found) setTown(found.city);
      return found ?? 'notFound';
    });
    return searching.current;
  };

  const next = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const found = await lookUp();
    if (found === 'notFound') return setSaving(false);
    const where = found
      ? {
          city: found.city,
          latitude: found.latitude,
          longitude: found.longitude,
          country_code: found.country_code,
          region_code: found.region_code,
        }
      : { city: null, latitude: null, longitude: null, country_code: null, region_code: null };
    // When editing, the time zone stays: the family member may live somewhere else
    const { error: e } = await supabase
      .from('people')
      .update(
        editing
          ? { talk_time: time, locale: language, ...where }
          : { talk_time: time, locale: language, timezone: deviceTimezone, ...where },
      )
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

      <View style={styles.spaced}>
        <TextField
          label={t.talkStep.placeLabel}
          placeholder={t.talkStep.placePlaceholder}
          value={town}
          onChangeText={(value) => {
            setTown(value);
            setPlaceState('idle');
          }}
          onBlur={() => lookUp()}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>
      <Text style={placeState === 'notFound' ? styles.error : styles.note}>
        {placeState === 'searching'
          ? t.talkStep.placeSearching
          : placeState === 'notFound'
            ? t.talkStep.placeNotFound
            : place && town.trim() === place.city && place.label !== place.city
              ? t.talkStep.placeFound(place.label)
              : t.talkStep.placeHint}
      </Text>

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
