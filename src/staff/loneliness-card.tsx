import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { addLoneliness, deleteLoneliness, useLoneliness } from './data';
import { staffColors, staffFont } from './theme';

/**
 * UCLA-3 (Hughes et al. 2004), asked by her carer at sign-up and then monthly, in her language.
 * English is the published wording; the Spanish and Dutch lines are our translations, for reading aloud.
 */
const QUESTIONS = [
  {
    key: 'companionship',
    en: 'How often do you feel that you lack companionship?',
    es: '¿Con qué frecuencia siente que le falta compañía?',
    nl: 'Hoe vaak heeft u het gevoel dat u gezelschap mist?',
  },
  {
    key: 'left_out',
    en: 'How often do you feel left out?',
    es: '¿Con qué frecuencia se siente excluido o excluida?',
    nl: 'Hoe vaak voelt u zich buitengesloten?',
  },
  {
    key: 'isolated',
    en: 'How often do you feel isolated from others?',
    es: '¿Con qué frecuencia se siente aislado o aislada de los demás?',
    nl: 'Hoe vaak voelt u zich geïsoleerd van anderen?',
  },
] as const;

const ANSWERS = [
  { value: 1, en: 'Hardly ever', es: 'Casi nunca', nl: 'Bijna nooit' },
  { value: 2, en: 'Some of the time', es: 'Algunas veces', nl: 'Soms' },
  { value: 3, en: 'Often', es: 'A menudo', nl: 'Vaak' },
] as const;

type Key = (typeof QUESTIONS)[number]['key'];
type Lang = 'es' | 'en' | 'nl';

/** A month between checks: after that the card asks for a new one */
const DUE_DAYS = 30;

/** How long ago, in ms (outside the component: reading the clock isn't render-pure) */
const ageMs = (iso: string) => Date.now() - new Date(iso).getTime();

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function LonelinessCard({ personId, locale, me }: { personId: string; locale: string; me: string }) {
  const checks = useLoneliness(personId);
  const [asking, setAsking] = useState(false);
  const [answers, setAnswers] = useState<Partial<Record<Key, number>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const lang: Lang = locale === 'en' || locale === 'nl' ? locale : 'es';

  const list = checks.data ?? [];
  const last = list[0];
  const first = list[list.length - 1];
  const due = !last || ageMs(last.taken_at) > DUE_DAYS * 86_400_000;
  const complete = QUESTIONS.every((q) => answers[q.key]);
  // Undo is for a mistaken answer: only your own, the same day (as staff_delete_loneliness)
  const undoable = last && last.user_id === me && ageMs(last.taken_at) < 18 * 3_600_000;

  const save = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(false);
    const ok = await addLoneliness(personId, answers as Record<Key, number>);
    setBusy(false);
    if (!ok) return setError(true);
    setAsking(false);
    setAnswers({});
    checks.reload();
  };

  const undo = async () => {
    if (!last || busy) return;
    setBusy(true);
    const ok = await deleteLoneliness(last.id);
    setBusy(false);
    if (ok) checks.reload();
  };

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <ScaleIcon />
          </View>
          <Text style={styles.label}>Loneliness · UCLA-3</Text>
        </View>
        {checks.data && due && !asking ? (
          <View style={styles.dueChip}>
            <Text style={styles.dueText}>{last ? 'Check due' : 'First check'}</Text>
          </View>
        ) : null}
      </View>

      {asking ? (
        <View style={styles.form}>
          <Text style={styles.detail}>
            Ask her first if she wants to answer. Read each question as written; she picks one of the three answers.
          </Text>
          {QUESTIONS.map((q, i) => (
            <View key={q.key} style={styles.question}>
              <Text style={styles.qText}>{`${i + 1}. ${q[lang]}`}</Text>
              {lang !== 'en' ? <Text style={styles.detail}>{q.en}</Text> : null}
              <View style={styles.options}>
                {ANSWERS.map((a) => {
                  const on = answers[q.key] === a.value;
                  return (
                    <Pressable
                      key={a.value}
                      onPress={() => setAnswers({ ...answers, [q.key]: a.value })}
                      style={on ? styles.optionOn : styles.option}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}>
                      <Text style={[styles.optionText, on && styles.optionTextOn]}>
                        {lang === 'en' ? a.en : `${a[lang]} · ${a.en}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={styles.buttons}>
            <Pressable
              onPress={save}
              style={complete ? styles.primary : [styles.primary, styles.off]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !complete }}>
              <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save answers'}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAsking(false);
                setAnswers({});
              }}
              accessibilityRole="button"
              hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{"The answers weren't saved. Try again."}</Text> : null}
        </View>
      ) : !checks.data ? (
        <Text style={styles.detail}>{checks.error ? "This didn't load." : 'Loading…'}</Text>
      ) : last ? (
        <>
          <View style={styles.scoreRow}>
            <Text style={styles.huge}>{last.score}</Text>
            <Text style={styles.detail}>of 9 · 3 is least lonely</Text>
          </View>
          <Text style={styles.detail}>
            {list.length > 1
              ? `${day(last.taken_at)} · ${first.score} at the first check, ${day(first.taken_at)}`
              : `${day(last.taken_at)} · first check`}
          </Text>
          <View style={styles.buttons}>
            <Pressable onPress={() => setAsking(true)} style={due ? styles.primary : styles.ghost} accessibilityRole="button">
              <Text style={due ? styles.primaryText : styles.ghostText}>Ask the 3 questions</Text>
            </Pressable>
            {undoable ? (
              <Pressable onPress={undo} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.cancel}>Undo last</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.big}>Not asked yet</Text>
          <Text style={styles.detail}>Three short questions, at sign-up and then every month. Reports compare them.</Text>
          <Pressable onPress={() => setAsking(true)} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>Ask the 3 questions</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function ScaleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round">
      <Path d="M4 16h16" />
      <Circle cx={8} cy={16} r={2.4} fill="#fff" />
      <Path d="M6 10.5c1.2-2 2.9-3 6-3s4.8 1 6 3" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 420,
    minWidth: 0,
    backgroundColor: staffColors.block,
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: staffFont,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: staffColors.soft,
  },
  dueChip: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.ink },
  dueText: { fontFamily: staffFont, fontSize: 13, color: '#fff' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  huge: { fontFamily: staffFont, fontSize: 52, lineHeight: 54, fontWeight: '500', letterSpacing: -2, color: staffColors.ink },
  big: { fontFamily: staffFont, fontSize: 19, fontWeight: '500', color: staffColors.ink },
  detail: { fontFamily: staffFont, fontSize: 14, lineHeight: 20, color: staffColors.soft },
  form: { gap: 18 },
  question: { gap: 6 },
  qText: { fontFamily: staffFont, fontSize: 17, lineHeight: 23, fontWeight: '500', color: staffColors.ink },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  option: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  optionOn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    justifyContent: 'center',
  },
  optionText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink },
  optionTextOn: { color: '#fff' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  primary: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    justifyContent: 'center',
  },
  primaryText: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: '#fff' },
  ghost: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.ink,
    justifyContent: 'center',
  },
  ghostText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
  off: { opacity: 0.4 },
  cancel: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted },
  error: { fontFamily: staffFont, fontSize: 14, color: staffColors.error },
});
