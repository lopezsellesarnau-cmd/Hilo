import { Link } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { findPlace, type Place } from '@/lib/place';
import { createPerson, type NewPerson, type NewPill } from '@/staff/data';
import { PairCard } from '@/staff/pair-card';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';

// The same choices as the family app's onboarding (talk.tsx)
const LANGUAGES = [
  { value: 'es', label: 'Spanish' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
] as const;
const TIMES = ['09:00', '10:00', '11:00', '12:00', '17:00', '18:00', '19:00'] as const;

// The browser is in the organisation, so its time zone is hers. Pill times are stored in local time.
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

type PillDraft = { key: number; name: string; times: string };

/** "9:00, 21.00 2130" → ["09:00", "21:00", "21:30"]; null if any of them isn't a time. */
function parseTimes(text: string): string[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (!parts.length || parts.length > 8) return null;
  const times = parts.map((p) => {
    const m = p.match(/^(\d{1,2})[:.h]?(\d{2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  });
  return times.every(Boolean) ? [...new Set(times as string[])].sort() : null;
}

/**
 * New person, as the "New person" frame of the staff canvas: staff add her, then pair her phone at the visit.
 * Left out until Hilo records them: photo, carer, the voice preview and inviting her family.
 */
export default function NewPersonPage() {
  const me = useStaff();
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<NewPerson['locale']>('es');
  const [talkTime, setTalkTime] = useState<string>('10:00');
  const [town, setTown] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [placeState, setPlaceState] = useState<'idle' | 'searching' | 'notFound'>('idle');
  const searching = useRef<Promise<Place | null | 'notFound'> | null>(null);
  const nextKey = useRef(1);
  const [pills, setPills] = useState<PillDraft[]>([]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  /** Looks her town up once (OpenStreetMap), unless it is the one already found. Null when the field is empty. */
  const lookUp = (): Promise<Place | null | 'notFound'> => {
    const query = town.trim();
    if (!query) return Promise.resolve(null);
    if (place && query === place.city) return Promise.resolve(place);
    if (searching.current) return searching.current;
    setPlaceState('searching');
    searching.current = findPlace(query, locale).then((found) => {
      searching.current = null;
      setPlace(found);
      setPlaceState(found ? 'idle' : 'notFound');
      if (found) setTown(found.city);
      return found ?? 'notFound';
    });
    return searching.current;
  };

  const parsed = pills.map((p) => ({ ...p, list: parseTimes(p.times) }));
  const pillsOk = parsed.every((p) => p.name.trim() && p.list);
  const ready = name.trim().length > 0 && pillsOk && !saving;

  const create = async () => {
    setTried(true);
    if (!ready) return;
    setSaving(true);
    setError(false);
    const found = await lookUp();
    if (found === 'notFound') return setSaving(false);
    const list: NewPill[] = parsed.map((p) => ({ name: p.name.trim(), times: p.list as string[] }));
    const id = await createPerson(me.orgId, {
      name: name.trim(),
      locale,
      talkTime,
      timezone,
      place: found,
      pills: list,
    });
    setSaving(false);
    if (!id) return setError(true);
    setCreated({ id, name: name.trim() });
  };

  const startAgain = () => {
    setName('');
    setTown('');
    setPlace(null);
    setPlaceState('idle');
    setPills([]);
    setTried(false);
    setCreated(null);
  };

  const editPill = (key: number, change: Partial<PillDraft>) =>
    setPills((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={staffText.label}>{created ? 'Step 2 of 2 · the home visit' : 'Step 1 of 2 · then the home visit'}</Text>
        <Text style={staffText.title}>New person</Text>
      </View>

      <View style={styles.wrap}>
        {created ? (
          <View style={styles.form}>
            <Text style={styles.done}>{`${created.name} is in ${me.orgName}.`}</Text>
            <Text style={styles.hint}>
              {`Her talks start once her phone is paired. Until then she shows on Today as "Phone not paired".`}
            </Text>
            <View style={styles.actions}>
              <Link href={{ pathname: '/staff/person/[id]', params: { id: created.id } }} asChild>
                <Pressable style={styles.button} accessibilityRole="link">
                  <Text style={styles.buttonText}>Open her profile →</Text>
                </Pressable>
              </Link>
              <Pressable onPress={startAgain} style={styles.ghost} accessibilityRole="button">
                <Text style={styles.ghostText}>Add another person</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={60}
                placeholder="Carmen"
                placeholderTextColor="#8a8a86"
                style={styles.input}
              />
              {tried && !name.trim() ? <Text style={styles.error}>Her name is needed.</Text> : null}
            </Field>

            <Field label="Language" hint="Hilo talks to her in it.">
              <Chips options={LANGUAGES} value={locale} onChange={setLocale} />
            </Field>

            <Field label="Talk time" hint="Her phone reminds her then. She can also talk at any other time.">
              <Chips options={TIMES.map((t) => ({ value: t, label: t }))} value={talkTime} onChange={setTalkTime} />
            </Field>

            <Field label="Town (optional)" hint="For the weather and the local holidays in her talks.">
              <TextInput
                value={town}
                onChangeText={(v) => {
                  setTown(v);
                  if (placeState === 'notFound') setPlaceState('idle');
                }}
                onBlur={() => void lookUp()}
                maxLength={80}
                placeholder="Alcoy"
                placeholderTextColor="#8a8a86"
                style={styles.input}
              />
              {placeState === 'searching' ? (
                <Text style={styles.hint}>Looking it up…</Text>
              ) : placeState === 'notFound' ? (
                <Text style={styles.error}>{"That town wasn't found. Check the spelling, or leave it empty."}</Text>
              ) : place && town.trim() === place.city ? (
                <Text style={styles.hint}>{place.label}</Text>
              ) : null}
            </Field>

            <Field label="Pills" hint="Name as she knows it, and the times. Several times with commas: 09:00, 21:00.">
              {parsed.map((p) => (
                <View key={p.key} style={styles.pillRow}>
                  <TextInput
                    value={p.name}
                    onChangeText={(v) => editPill(p.key, { name: v })}
                    maxLength={80}
                    placeholder="Enalapril"
                    placeholderTextColor="#8a8a86"
                    style={[styles.input, styles.pillName]}
                  />
                  <TextInput
                    value={p.times}
                    onChangeText={(v) => editPill(p.key, { times: v })}
                    placeholder="09:00"
                    placeholderTextColor="#8a8a86"
                    style={[styles.input, styles.pillTimes]}
                  />
                  <Pressable
                    onPress={() => setPills((list) => list.filter((x) => x.key !== p.key))}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${p.name || 'this pill'}`}>
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                  {tried && (!p.name.trim() || !p.list) ? (
                    <Text style={[styles.error, styles.pillError]}>
                      {!p.name.trim() ? 'The pill needs a name.' : 'Times like 09:00, up to 8.'}
                    </Text>
                  ) : null}
                </View>
              ))}
              {pills.length < 20 ? (
                <Pressable
                  onPress={() => setPills((list) => [...list, { key: nextKey.current++, name: '', times: '' }])}
                  style={styles.add}
                  accessibilityRole="button">
                  <Text style={styles.addText}>+ Add a pill</Text>
                </Pressable>
              ) : null}
            </Field>

            <View style={styles.actions}>
              <Pressable
                onPress={create}
                style={[styles.button, !ready && styles.buttonOff]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}>
                <Text style={styles.buttonText}>{saving ? 'Creating…' : 'Create her'}</Text>
              </Pressable>
              <Link href="/staff" style={styles.cancel}>
                Cancel
              </Link>
            </View>
            {error ? <Text style={styles.error}>{"She wasn't created. Check the connection and try again."}</Text> : null}
          </View>
        )}

        <View style={styles.side}>
          {created ? (
            <PairCard personId={created.id} name={created.name} />
          ) : (
            <View style={styles.waiting}>
              <Text style={styles.hint}>The code to pair her phone appears here once you create her.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={staffText.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 40, paddingHorizontal: 56, paddingBottom: 64, gap: 32, maxWidth: 1320 },
  head: { gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' },
  form: { flexGrow: 1, flexShrink: 1, flexBasis: 520, maxWidth: 640, gap: 28 },
  side: { flexGrow: 1, flexShrink: 1, flexBasis: 360, maxWidth: 560 },
  field: { gap: 10 },
  input: {
    fontFamily: staffFont,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: staffColors.block,
    color: staffColors.ink,
  },
  hint: { fontFamily: staffFont, fontSize: 14, lineHeight: 20, color: staffColors.muted },
  error: { fontFamily: staffFont, fontSize: 14, lineHeight: 20, color: staffColors.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, borderColor: staffColors.line },
  chipOn: { backgroundColor: staffColors.ink, borderColor: staffColors.ink },
  chipText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: '#fff' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pillName: { flexGrow: 2, flexShrink: 1, flexBasis: 200 },
  pillTimes: { flexGrow: 1, flexShrink: 1, flexBasis: 140, fontVariant: ['tabular-nums'] },
  pillError: { flexBasis: '100%' },
  remove: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontFamily: staffFont, fontSize: 22, color: staffColors.muted },
  add: { alignSelf: 'flex-start', paddingVertical: 8 },
  addText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: staffColors.ink,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  buttonOff: { opacity: 0.4 },
  buttonText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  ghost: { borderRadius: 999, borderWidth: 1, borderColor: staffColors.line, paddingHorizontal: 22, paddingVertical: 11 },
  ghostText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
  cancel: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted },
  done: { fontFamily: staffFont, fontSize: 28, lineHeight: 34, fontWeight: '300', color: staffColors.ink },
  waiting: {
    borderRadius: 28,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: staffColors.line,
    paddingVertical: 40,
    paddingHorizontal: 28,
  },
});
