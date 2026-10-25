import { Link, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  clock,
  signalLines,
  usePersonPage,
  useStaffPeople,
  useStaffSignals,
  type PersonWeek,
  type StaffAction,
} from '@/staff/data';
import { BellIcon, BotMark, NoteIcon, PillIcon } from '@/staff/icons';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const date = (iso: string, withYear = false) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }) });
// "2026-10-25" is a local day: read it at noon so no timezone moves it to the day before
const dayLetter = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1);
const daysAgo = (iso: string) => {
  const n = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};

/**
 * Person, as the "Person" frame of the staff canvas (variant B). Real data only: where the canvas shows
 * something Hilo doesn't record yet (her mood, "What to talk about", phone calls) the page leaves it out.
 */
export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const people = useStaffPeople();
  const signals = useStaffSignals();
  const page = usePersonPage(id);

  const person = people.data?.find((p) => p.id === id && p.role === 'senior');
  const failed = people.error || signals.error || page.error;
  const loading = !people.data || !signals.data || !page.data;

  if (failed || loading || !person || !page.data) {
    return (
      <View style={styles.page}>
        <View style={styles.content}>
          <Back />
          {failed ? (
            <>
              <Text style={staffText.body}>{"This page didn't load. Try again."}</Text>
              <Pressable
                onPress={() => {
                  people.reload();
                  signals.reload();
                  page.reload();
                }}
                style={styles.ghost}
                accessibilityRole="button">
                <Text style={styles.ghostText}>Try again</Text>
              </Pressable>
            </>
          ) : loading ? (
            <Text style={staffText.note}>Loading…</Text>
          ) : (
            <Text style={staffText.body}>This person is not in your organisation.</Text>
          )}
        </View>
      </View>
    );
  }

  const { week, notes } = page.data;
  const alerts = (signals.data ?? []).filter((s) => s.person_id === id);
  const family = (people.data ?? []).filter((p) => p.role === 'member' && p.family_id === person.family_id);
  const due = week.days.reduce((n, d) => n + d.due, 0);
  const taken = week.days.reduce((n, d) => n + d.taken, 0);
  const callsWeek = week.days.reduce((n, d) => n + d.calls, 0);
  const latest = notes.find((n) => n.note);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Back />
        {alerts.length ? (
          <View style={styles.chipDark}>
            <Text style={styles.chipDarkText}>High priority today</Text>
          </View>
        ) : (
          <View style={styles.chipGrey}>
            <Text style={styles.chipText}>No alerts today</Text>
          </View>
        )}
      </View>

      <View style={styles.wrap}>
        {/* Two-half card: name on white, the big bot on black, faded at the bottom (Arnau's blur) */}
        <View style={styles.hero} accessibilityLabel={person.display_name}>
          <View style={styles.heroTop}>
            <Text style={styles.heroName}>{person.display_name}</Text>
            <Text style={styles.heroLine}>
              Since {date(person.created_at, true)} · {person.paired ? 'phone paired' : 'phone not paired'}
            </Text>
          </View>
          <View style={styles.heroBottom}>
            <View style={styles.heroBot}>
              <BotMark size={210} light />
            </View>
            <View style={styles.heroFade} />
          </View>
        </View>

        <View style={styles.weekCard}>
          <View style={styles.weekHead}>
            <Text style={styles.h2}>Last 7 days</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>No</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.dotOn]} />
                <Text style={styles.legendText}>Yes</Text>
              </View>
            </View>
          </View>
          <Week week={week} />
          <Text style={styles.weekFoot}>
            {week.last_talk ? `Last talk with Hilo ${date(week.last_talk)}, ${clock(week.last_talk)}` : 'No talk yet'}
          </Text>
        </View>
      </View>

      <View style={styles.wrap}>
        <LatestNote note={latest} />

        <View style={styles.grid}>
          <Card title="Signals today" icon={<BellIcon color="#fff" size={22} />} right={<Count n={alerts.length} />}>
            {alerts.length ? (
              alerts.map((a) => {
                const l = signalLines(a);
                return (
                  <View key={a.kind} style={styles.signal}>
                    <View style={styles.signalDot} />
                    <View style={styles.signalText}>
                      <Text style={styles.big}>{l.title}</Text>
                      <Text style={styles.detail}>{l.detail}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.big}>Nothing today</Text>
            )}
          </Card>

          <Card
            title="Pills"
            icon={<PillIcon color="#fff" size={22} />}
            right={<Text style={styles.detail}>7 days</Text>}>
            {due ? (
              <>
                <View style={styles.pct}>
                  <Text style={styles.huge}>{Math.round((taken / due) * 100)} %</Text>
                  <Text style={styles.detail}>confirmed</Text>
                </View>
                <View style={styles.pillRows}>
                  {week.days
                    .filter((d) => d.due)
                    .slice(-2)
                    .reverse()
                    .map((d, i) => (
                      <View key={d.day} style={styles.pillRow}>
                        <Text style={styles.pillLabel}>
                          {i === 0 && d.day === week.days[6].day ? 'Today' : date(`${d.day}T12:00:00`)} · {d.taken} of{' '}
                          {d.due}
                        </Text>
                        <View style={[styles.tick, d.taken >= d.due && styles.tickOn]}>
                          {d.taken >= d.due ? <Text style={styles.tickText}>✓</Text> : null}
                        </View>
                      </View>
                    ))}
                </View>
              </>
            ) : (
              <Text style={styles.big}>No pills set up</Text>
            )}
          </Card>

          <View style={styles.family}>
            <View style={styles.cardHead}>
              <View style={styles.iconDark}>
                <HeartIcon />
              </View>
              <Text style={styles.cardLabel}>Family</Text>
            </View>
            {family.length ? (
              family.map((f) => (
                <View key={f.id} style={styles.member}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>{f.display_name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.big}>{f.display_name}</Text>
                    <Text style={styles.detail}>
                      {week.last_call ? `Last family call ${daysAgo(week.last_call)}` : 'No call yet'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.big}>No family in Hilo</Text>
            )}
            <View style={styles.chipGrey}>
              <Text style={styles.chipText}>
                {callsWeek} {callsWeek === 1 ? 'call' : 'calls'} this week
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.wrap}>
        <View style={styles.actions}>
          <Text style={staffText.label}>Team actions</Text>
          {notes.length ? (
            notes.map((n) => (
              <View key={n.id} style={styles.action}>
                <Text style={styles.actionDate}>{date(n.created_at)}</Text>
                <Text style={styles.actionWho}>Done · {n.by}</Text>
                <Text style={styles.actionNote}>{n.note || 'No note'}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.actionNote}>Nothing yet. Save · done on Today adds a line here.</Text>
          )}
        </View>
        <View style={styles.privacy}>
          <Text style={staffText.label}>What staff can see</Text>
          <Text style={styles.privacyText}>
            Whether she talked, her pills, family calls and the team&rsquo;s notes.
          </Text>
          <Text style={[styles.privacyText, styles.bold]}>Never what she says word for word, nor her book.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Back() {
  return (
    <Link href="/staff" style={styles.back}>
      ← Back to Today
    </Link>
  );
}

function Count({ n }: { n: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countText}>{n}</Text>
    </View>
  );
}

function HeartIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinejoin="round">
      <Path d="M12 19.5s-7-4.3-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.2c0 5-7 9.3-7 9.3z" />
    </Svg>
  );
}

function Card({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <View style={styles.cardHead}>
          <View style={styles.iconDark}>{icon}</View>
          <Text style={styles.cardLabel}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Big black card: the latest team note (the canvas's "What to talk about" needs data Hilo doesn't share yet). */
function LatestNote({ note }: { note: StaffAction | undefined }) {
  return (
    <View style={styles.dark}>
      <View style={styles.cardHead}>
        <View style={styles.iconLight}>
          <NoteIcon color={staffColors.ink} size={22} />
        </View>
        <Text style={[styles.cardLabel, styles.darkLabel]}>Latest team note</Text>
      </View>
      <Text style={styles.darkBig}>{note ? note.note : 'No notes yet.'}</Text>
      {note ? null : <Text style={styles.darkMid}>→ Write one with Save · done on Today.</Text>}
      <Text style={styles.darkFoot}>
        {note ? `${date(note.created_at)}, ${clock(note.created_at)} · ${note.by}` : 'Only the team sees these notes'}
      </Text>
    </View>
  );
}

/** Rows Talk / Pills / Family call, one circle per day, filled when it happened. */
function Week({ week }: { week: PersonWeek }) {
  const rows: { label: string; on: (d: PersonWeek['days'][number]) => boolean | null }[] = [
    { label: 'Talk', on: (d) => d.talks > 0 },
    { label: 'Pills', on: (d) => (d.due ? d.taken >= d.due : null) },
    { label: 'Family call', on: (d) => d.calls > 0 },
  ];
  return (
    <View style={styles.weekGrid}>
      <View style={styles.weekRow}>
        <View style={styles.weekLabelCol} />
        {week.days.map((d) => (
          <Text key={d.day} style={styles.weekDay}>
            {dayLetter(d.day)}
          </Text>
        ))}
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.weekRow}>
          <Text style={[styles.weekLabelCol, styles.weekLabel]}>{r.label}</Text>
          {week.days.map((d) => {
            const on = r.on(d);
            return (
              <View key={d.day} style={styles.weekCell}>
                {on === null ? (
                  <Text style={styles.detail}>–</Text>
                ) : (
                  <View
                    style={[styles.dot, on && styles.dotOn]}
                    accessibilityLabel={`${r.label} ${on ? 'yes' : 'no'}`}
                  />
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const flex = (grow: number, basis: number): ViewStyle => ({
  flexGrow: grow,
  flexShrink: 1,
  flexBasis: basis,
  minWidth: 0,
});

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 40, paddingHorizontal: 56, paddingBottom: 64, gap: 32, maxWidth: 1320 },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  back: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted, paddingVertical: 12 },
  chipDark: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, backgroundColor: staffColors.ink },
  chipDarkText: { fontFamily: staffFont, fontSize: 14, color: '#fff' },
  chipGrey: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    backgroundColor: staffColors.block,
  },
  chipText: { fontFamily: staffFont, fontSize: 14, color: staffColors.ink },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' },

  hero: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 300,
    minWidth: 260,
    height: 302,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: staffColors.ink,
    borderWidth: 2,
    borderColor: staffColors.ink,
  },
  heroTop: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingTop: 50,
    paddingHorizontal: 22,
    paddingBottom: 22,
    gap: 6,
    zIndex: 2,
  },
  heroName: {
    fontFamily: staffFont,
    fontSize: 40,
    lineHeight: 42,
    fontWeight: '300',
    letterSpacing: -1.2,
    color: staffColors.ink,
  },
  heroLine: {
    fontFamily: staffFont,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: staffColors.ink,
  },
  heroBottom: { flex: 1, overflow: 'hidden' },
  heroBot: { position: 'absolute', top: 22, left: 0, right: 0, alignItems: 'center' },
  heroFade: {
    position: 'absolute',
    left: -1,
    right: -1,
    top: 146,
    height: 94,
    borderRadius: 20,
    backgroundColor: staffColors.ink,
    // web only (the staff pages never run on the phone)
    filter: 'blur(19px)',
  } as ViewStyle,

  weekCard: {
    ...flex(1, 460),
    backgroundColor: staffColors.block,
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 28,
    gap: 18,
  },
  weekHead: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  h2: { fontFamily: staffFont, fontSize: 16, fontWeight: '500', color: staffColors.ink },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: staffColors.ink,
    backgroundColor: '#fff',
  },
  legendText: { fontFamily: staffFont, fontSize: 13, color: staffColors.ink },
  weekGrid: { gap: 16 },
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  weekLabelCol: { width: 120 },
  weekLabel: { fontFamily: staffFont, fontSize: 14, fontWeight: '500', color: staffColors.ink },
  weekDay: {
    flex: 1,
    minWidth: 36,
    textAlign: 'center',
    fontFamily: staffFont,
    fontSize: 12,
    color: staffColors.muted,
  },
  weekCell: { flex: 1, minWidth: 36, alignItems: 'center' },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: staffColors.ink,
    backgroundColor: '#fff',
  },
  dotOn: { backgroundColor: staffColors.ink },
  weekFoot: { marginTop: 'auto', fontFamily: staffFont, fontSize: 13, color: staffColors.muted },

  dark: { ...flex(1, 340), minHeight: 340, backgroundColor: staffColors.ink, borderRadius: 28, padding: 28, gap: 22 },
  darkLabel: { color: '#bdbdbd' },
  darkBig: { fontFamily: staffFont, fontSize: 28, lineHeight: 36, letterSpacing: -0.5, color: '#fff' },
  darkMid: { fontFamily: staffFont, fontSize: 20, lineHeight: 28, color: '#fff' },
  darkFoot: { marginTop: 'auto', fontFamily: staffFont, fontSize: 13, color: '#bdbdbd' },
  iconLight: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: { ...flex(2, 520), flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { ...flex(1, 240), backgroundColor: staffColors.block, borderRadius: 28, padding: 24, gap: 18 },
  cardHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconDark: {
    width: 40,
    height: 40,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: staffFont,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: staffColors.soft,
  },
  count: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 99, backgroundColor: staffColors.ink },
  countText: { fontFamily: staffFont, fontSize: 13, color: '#fff' },
  signal: { flexDirection: 'row', gap: 12 },
  signalDot: { width: 10, height: 10, borderRadius: 99, backgroundColor: staffColors.ink, marginTop: 8 },
  signalText: { flex: 1, gap: 2 },
  big: { fontFamily: staffFont, fontSize: 19, fontWeight: '500', color: staffColors.ink },
  detail: { fontFamily: staffFont, fontSize: 14, color: staffColors.soft },
  pct: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  huge: {
    fontFamily: staffFont,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '500',
    letterSpacing: -1.5,
    color: staffColors.ink,
  },
  pillRows: { gap: 8 },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  pillLabel: { fontFamily: staffFont, fontSize: 16, color: staffColors.ink },
  tick: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderWidth: 2,
    borderColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { backgroundColor: staffColors.ink },
  tickText: { fontFamily: staffFont, fontSize: 12, color: '#fff' },
  family: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e3e3e3',
    backgroundColor: '#fff',
  },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, flexGrow: 1 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: staffColors.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { fontFamily: staffFont, fontSize: 15, fontWeight: '700', color: staffColors.ink },

  actions: { ...flex(2, 420), borderWidth: 1, borderColor: '#ececec', borderRadius: 22, padding: 24, gap: 16 },
  action: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  actionDate: { minWidth: 70, fontFamily: staffFont, fontSize: 14, color: staffColors.muted },
  actionWho: { fontFamily: staffFont, fontSize: 15, fontWeight: '500', color: staffColors.ink },
  actionNote: { fontFamily: staffFont, fontSize: 15, color: staffColors.soft },
  privacy: {
    ...flex(1, 300),
    alignSelf: 'flex-start',
    backgroundColor: staffColors.block,
    borderRadius: 22,
    padding: 24,
    gap: 12,
  },
  privacyText: { fontFamily: staffFont, fontSize: 15, lineHeight: 22, color: staffColors.ink },
  bold: { fontWeight: '500' },
  ghost: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: staffColors.ink,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ghostText: { fontFamily: staffFont, fontSize: 15, color: staffColors.ink },
});
