import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { clock, type StaffAction, type StaffPerson, type StaffSignal } from './data';
import { staffColors, staffFont } from './theme';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** Each alert in plain words, and where the fact comes from. Never anything she said. */
function evidence(s: StaffSignal): { what: string; source: string } {
  if (s.kind === 'no_talk') {
    return {
      what: `She hasn't talked with Hilo for ${s.value} days.`,
      source: s.since ? `Last talk ${day(s.since)}, ${clock(s.since)}` : 'Joined, no talk yet',
    };
  }
  if (s.kind === 'no_family') {
    return {
      what: `No family call for ${s.value} days.`,
      source: s.since ? `Last call ${day(s.since)}` : 'No family call yet',
    };
  }
  return {
    what:
      s.total && s.total > 1
        ? `Yesterday she didn't confirm ${s.value} of ${s.total} pills.`
        : "Yesterday she didn't confirm her pill.",
    source: 'Pill reminders on her phone (she or the family confirm)',
  };
}

type Props = {
  person: StaffPerson;
  family: StaffPerson[];
  alerts: StaffSignal[];
  done: StaffAction | undefined;
  /** Is the signed-in staff member the one who marked it done (only they can undo) */
  mine: boolean;
  onDone: (note: string) => Promise<boolean>;
  onUndo: () => Promise<boolean>;
};

/** Right side of Today: why someone is on the list, and "Save · done" with a note for the team. */
export function WhyPanel({ person, family, alerts, done, mine, onDone, onUndo }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = person.display_name;

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true);
    setFailed(false);
    const ok = await fn();
    setBusy(false);
    if (ok) setNote('');
    else setFailed(true);
  };

  return (
    <View style={styles.aside} accessibilityLabel={`Why ${name} is on the list`}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={1.8}
            strokeLinecap="round">
            <Path d="M12 8v5M12 16.5v.5" />
            <Circle cx={12} cy={12} r={8.5} />
          </Svg>
        </View>
        <View style={styles.titleBox}>
          <Text style={styles.title}>{alerts.length ? `Why ${name} is on the list` : `${name} has no alerts`}</Text>
          <Text style={styles.muted}>
            {family.length ? `Family in Hilo: ${family.map((f) => f.display_name).join(', ')}` : 'No family in Hilo'}
          </Text>
        </View>
        <Link href={{ pathname: '/staff/person/[id]', params: { id: person.id } }} asChild>
          <Pressable style={styles.open} accessibilityRole="link">
            <Text style={styles.openText}>Open profile →</Text>
          </Pressable>
        </Link>
        {alerts.length ? (
          <View style={styles.list}>
            {alerts.map((a) => {
              const e = evidence(a);
              return (
                <View key={a.kind} style={styles.item}>
                  <Text style={styles.what}>{e.what}</Text>
                  <Text style={styles.source}>{e.source}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.what}>She talks with Hilo, takes her pills and hears from her family.</Text>
        )}
      </View>

      <View style={styles.dark}>
        {done ? (
          <>
            <Text style={styles.darkLabel}>Done</Text>
            <Text style={styles.darkText}>
              {clock(done.created_at)} · {done.by}
            </Text>
            {done.note ? <Text style={styles.darkNote}>{done.note}</Text> : null}
            {mine ? (
              <Pressable
                onPress={busy ? undefined : () => run(onUndo)}
                style={styles.lightButton}
                accessibilityRole="button">
                <Text style={styles.lightButtonText}>{busy ? 'One moment…' : 'Undo'}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.darkLabel}>Call note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
              placeholder="What you talked about, whether she needs a visit…"
              placeholderTextColor="#8a8a86"
              style={styles.input}
            />
            <View style={styles.darkFoot}>
              <Text style={styles.darkHint}>The team sees this note. Staff never see what she said to Hilo.</Text>
              <Pressable
                onPress={busy ? undefined : () => run(() => onDone(note))}
                style={styles.lightButton}
                accessibilityRole="button">
                <Text style={styles.lightButtonText}>{busy ? 'Saving…' : 'Save · done'}</Text>
              </Pressable>
            </View>
          </>
        )}
        {failed ? <Text style={styles.error}>{"That didn't save. Try again."}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  aside: { gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ececec',
    borderRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 22,
    gap: 18,
    shadowColor: '#141310',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBox: { gap: 8 },
  title: {
    fontFamily: staffFont,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.4,
    color: staffColors.ink,
  },
  muted: { fontFamily: staffFont, fontSize: 14, color: staffColors.muted },
  // A single style object: Link asChild warns about style arrays
  open: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openText: { fontFamily: staffFont, fontSize: 14, fontWeight: '500', color: '#fff' },
  list: { gap: 14 },
  item: { gap: 3 },
  what: {
    fontFamily: staffFont,
    fontSize: 15,
    lineHeight: 22,
    color: staffColors.ink,
  },
  source: { fontFamily: staffFont, fontSize: 13, color: staffColors.muted },
  dark: {
    backgroundColor: staffColors.ink,
    borderRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  darkLabel: {
    fontFamily: staffFont,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#bdbdbd',
  },
  darkText: { fontFamily: staffFont, fontSize: 15, color: '#fff' },
  darkNote: {
    fontFamily: staffFont,
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
  },
  input: {
    minHeight: 84,
    fontFamily: staffFont,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: staffColors.soft,
    backgroundColor: '#1f1e1b',
    color: '#fff',
  },
  darkFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  darkHint: { flex: 1, fontFamily: staffFont, fontSize: 12, color: '#bdbdbd' },
  lightButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 99,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightButtonText: {
    fontFamily: staffFont,
    fontSize: 14,
    color: staffColors.ink,
  },
  error: { fontFamily: staffFont, fontSize: 13, color: '#ff8a80' },
});
