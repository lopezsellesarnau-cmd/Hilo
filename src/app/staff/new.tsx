import { Link } from 'expo-router';
import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { findPlace, type Place } from '@/lib/place';
import { createPerson, useTeam, type NewPerson, type NewPill } from '@/staff/data';
import { BotMark } from '@/staff/icons';
import { PairCard } from '@/staff/pair-card';
import { useStaff } from '@/staff/session';
import { staffColors, staffFont, staffText } from '@/staff/theme';
import { VoiceCard } from '@/staff/voice-card';

const LANGUAGES = [
  { value: 'es', label: 'Spanish' },
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
] as const;

// The browser is in the organisation, so its time zone is hers. Pill times are stored in local time.
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';

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
 * New person, as the "New person" frame of the staff canvas: staff add her, hear Hilo's voice and pick its speed,
 * then pair her phone at the visit. Left out until Hilo records them: photo and inviting her family by email.
 */
export default function NewPersonPage() {
  const me = useStaff();
  const team = useTeam();
  const [name, setName] = useState('');
  const [locale, setLocale] = useState<NewPerson['locale']>('es');
  const [talkTime, setTalkTime] = useState('10:00');
  const [speed, setSpeed] = useState(1);
  // A carer adding someone is usually her carer; a coordinator picks one
  const [carerId, setCarerId] = useState<string | null>(me.role === 'carer' ? me.userId : null);
  const [town, setTown] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [placeState, setPlaceState] = useState<'idle' | 'searching' | 'notFound'>('idle');
  const searching = useRef<Promise<Place | null | 'notFound'> | null>(null);
  const [pills, setPills] = useState<NewPill[]>([]);
  const [draft, setDraft] = useState<{ name: string; times: string } | null>(null);
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

  const draftTimes = draft ? parseTimes(draft.times) : null;
  const draftOk = !!draft && !!draft.name.trim() && !!draftTimes;
  const addPill = () => {
    if (!draft || !draftOk) return;
    setPills((list) => [...list, { name: draft.name.trim(), times: draftTimes as string[] }]);
    setDraft(null);
  };

  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(talkTime);
  const ready = name.trim().length > 0 && timeOk && !draft && !saving;

  const create = async () => {
    setTried(true);
    if (!ready) return;
    setSaving(true);
    setError(false);
    const found = await lookUp();
    if (found === 'notFound') return setSaving(false);
    const id = await createPerson(me.orgId, {
      name: name.trim(),
      locale,
      talkTime,
      timezone,
      voiceSpeed: speed,
      carerId,
      place: found,
      pills,
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
    setDraft(null);
    setSpeed(1);
    setTried(false);
    setCreated(null);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={staffText.label}>{created ? 'Step 2 of 2 · the home visit' : 'Step 1 of 2 · then the home visit'}</Text>
        <Text style={styles.title}>New person</Text>
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
                <Pressable style={linkStyles.open} accessibilityRole="link">
                  <Text style={styles.primaryText}>Open her profile →</Text>
                </Pressable>
              </Link>
              <Pressable onPress={startAgain} style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryText}>Add another person</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.photoRow}>
              <View style={styles.avatar}>
                <BotMark size={70} />
              </View>
              <Text style={styles.hint}>No photo yet: Hilo is shown for her.</Text>
            </View>

            <View style={styles.grid}>
              <Field label="Name">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  placeholder="Carmen Ruiz"
                  placeholderTextColor="#8a8a86"
                  style={styles.input}
                />
                {tried && !name.trim() ? <Text style={styles.error}>Her name is needed.</Text> : null}
              </Field>
              <Field label="Language">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as NewPerson['locale'])}
                  style={domField}
                  aria-label="Language">
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Talk time">
                <input
                  type="time"
                  value={talkTime}
                  onChange={(e) => setTalkTime(e.target.value)}
                  style={domField}
                  aria-label="Talk time"
                />
                {tried && !timeOk ? <Text style={styles.error}>Pick a time.</Text> : null}
              </Field>
              <Field label="Carer">
                <select
                  value={carerId ?? ''}
                  onChange={(e) => setCarerId(e.target.value || null)}
                  style={domField}
                  aria-label="Carer">
                  <option value="">Not assigned</option>
                  {(team.data ?? []).map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </Field>
            </View>

            <View style={styles.box}>
              <Text style={staffText.label}>Pills</Text>
              <View style={styles.chips}>
                {pills.map((p, i) => (
                  <View key={`${p.name}-${i}`} style={styles.pill}>
                    <Text style={styles.pillText}>{`${p.name} · ${p.times.join(', ')}`}</Text>
                    <Pressable
                      onPress={() => setPills((list) => list.filter((_, j) => j !== i))}
                      style={styles.remove}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${p.name}`}>
                      <Text style={styles.removeText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {draft || pills.length >= 20 ? null : (
                  <Pressable onPress={() => setDraft({ name: '', times: '' })} style={styles.add} accessibilityRole="button">
                    <Text style={styles.addText}>+ Add a pill</Text>
                  </Pressable>
                )}
              </View>
              {draft ? (
                <View style={styles.draft}>
                  <TextInput
                    value={draft.name}
                    onChangeText={(v) => setDraft({ ...draft, name: v })}
                    maxLength={80}
                    placeholder="Enalapril"
                    placeholderTextColor="#8a8a86"
                    style={[styles.draftInput, styles.draftName]}
                    autoFocus
                  />
                  <TextInput
                    value={draft.times}
                    onChangeText={(v) => setDraft({ ...draft, times: v })}
                    onSubmitEditing={addPill}
                    placeholder="09:00, 21:00"
                    placeholderTextColor="#8a8a86"
                    style={[styles.draftInput, styles.draftTimes]}
                  />
                  <Pressable
                    onPress={addPill}
                    style={[styles.smallPrimary, !draftOk && styles.off]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !draftOk }}>
                    <Text style={styles.smallPrimaryText}>Add</Text>
                  </Pressable>
                  <Pressable onPress={() => setDraft(null)} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  {draft.times.trim() && !draftTimes ? (
                    <Text style={[styles.error, styles.full]}>Times like 09:00, several with commas, up to 8.</Text>
                  ) : null}
                </View>
              ) : null}
              {tried && draft ? <Text style={styles.error}>Add or cancel the pill first.</Text> : null}
            </View>

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

            <View style={styles.actions}>
              <Pressable
                onPress={create}
                style={[styles.primary, styles.primaryWide, !ready && styles.off]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}>
                <Text style={styles.primaryText}>{saving ? 'Creating…' : 'Create her'}</Text>
              </Pressable>
              <Link href="/staff" asChild>
                <Pressable style={linkStyles.cancel} accessibilityRole="link">
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
              </Link>
            </View>
            {error ? <Text style={styles.error}>{"She wasn't created. Check the connection and try again."}</Text> : null}
          </View>
        )}

        <View style={styles.side}>
          {created ? null : <VoiceCard locale={locale} name={name} speed={speed} onSpeed={setSpeed} />}
          {created ? (
            <PairCard personId={created.id} name={created.name} />
          ) : (
            <View style={styles.waiting}>
              <Text style={styles.waitingText}>The code to pair her phone appears here once you create her.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/** A grey block with its label on top, as the frame's fields */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.box}>
      <Text style={staffText.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// The browser's own select and time picker (the staff pages are web only): styled like the text fields
const domField: CSSProperties = {
  border: 0,
  background: 'transparent',
  fontFamily: staffFont,
  fontSize: 17,
  padding: '4px 0',
  color: staffColors.ink,
  outline: 'none',
  width: '100%',
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 48, paddingHorizontal: 56, paddingBottom: 64, gap: 40, maxWidth: 1320 },
  head: { gap: 10 },
  title: { fontFamily: staffFont, fontSize: 44, lineHeight: 44, fontWeight: '500', letterSpacing: -1.5, color: staffColors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' },
  form: { flexGrow: 999, flexShrink: 1, flexBasis: 480, minWidth: 0, gap: 16 },
  side: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0, maxWidth: 380, gap: 28 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20, paddingBottom: 8 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 99,
    borderWidth: 6,
    borderColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  box: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    backgroundColor: staffColors.block,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 6,
  },
  input: { fontFamily: staffFont, fontSize: 17, paddingVertical: 4, color: staffColors.ink },
  hint: { fontFamily: staffFont, fontSize: 13, lineHeight: 18, color: staffColors.muted },
  error: { fontFamily: staffFont, fontSize: 13, lineHeight: 18, color: staffColors.error },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 16,
    borderRadius: 99,
    backgroundColor: '#fff',
  },
  pillText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink, fontVariant: ['tabular-nums'] },
  remove: {
    width: 36,
    height: 36,
    borderRadius: 99,
    backgroundColor: staffColors.block,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontFamily: staffFont, fontSize: 18, color: staffColors.ink },
  add: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 99,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#8a8a8a',
    justifyContent: 'center',
  },
  addText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
  draft: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  draftInput: {
    fontFamily: staffFont,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 99,
    backgroundColor: '#fff',
    color: staffColors.ink,
  },
  draftName: { flexGrow: 2, flexShrink: 1, flexBasis: 180 },
  draftTimes: { flexGrow: 1, flexShrink: 1, flexBasis: 130, fontVariant: ['tabular-nums'] },
  smallPrimary: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    justifyContent: 'center',
  },
  smallPrimaryText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  cancelText: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted, paddingHorizontal: 6 },
  full: { flexBasis: '100%' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  primary: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryWide: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  primaryText: { fontFamily: staffFont, fontSize: 17, color: '#fff' },
  secondary: {
    minHeight: 52,
    paddingHorizontal: 24,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#e3e3e3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { flexGrow: 0, flexShrink: 1, flexBasis: 160 },
  secondaryText: { fontFamily: staffFont, fontSize: 17, color: staffColors.ink },
  off: { opacity: 0.4 },

  done: { fontFamily: staffFont, fontSize: 28, lineHeight: 34, fontWeight: '300', color: staffColors.ink },
  waiting: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#c9c9c9', borderRadius: 28, padding: 28 },
  waitingText: { fontFamily: staffFont, fontSize: 15, lineHeight: 22, color: staffColors.muted },
});

// <Link asChild> hands its child's style through a Slot, which wants one flat style, not an array
const linkStyles = {
  open: StyleSheet.flatten([styles.primary, styles.primaryWide]),
  cancel: StyleSheet.flatten([styles.secondary, styles.cancel]),
};
