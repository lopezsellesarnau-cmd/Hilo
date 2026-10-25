import { Link, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { clock, signalText, usePersonPage, useStaffPeople, useStaffSignals, type PersonWeek } from '@/staff/data';
import { BellIcon, BotMark, FamilyIcon, NoteIcon, PillIcon } from '@/staff/icons';
import { staffColors, staffFont, staffText } from '@/staff/theme';

const date = (iso: string, withYear = false) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear && { year: 'numeric' }) });
// "2026-10-25" is a local day: read it at noon so no timezone moves it to the day before
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
const dayNum = (day: string) => new Date(`${day}T12:00:00`).getDate();

/**
 * Person (variant B of the canvas): who she is, her last 7 days in counts, today's alerts, pills, family and
 * the team's notes. Nothing she said: talks are counted, never shown.
 */
export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const people = useStaffPeople();
  const signals = useStaffSignals();
  const page = usePersonPage(id);

  const person = people.data?.find((p) => p.id === id && p.role === 'senior');
  const failed = people.error || signals.error || page.error;
  const loading = !people.data || !signals.data || !page.data;

  if (failed || (!loading && !person)) {
    return (
      <View style={styles.page}>
        <View style={styles.content}>
          <Back />
          <Text style={staffText.body}>
            {person || failed ? "This page didn't load. Try again." : 'This person is not in your organisation.'}
          </Text>
          {failed ? (
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
          ) : null}
        </View>
      </View>
    );
  }
  if (loading || !person || !page.data) {
    return (
      <View style={styles.page}>
        <View style={styles.content}>
          <Back />
          <Text style={staffText.note}>Loading…</Text>
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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Back />

      <View style={styles.wrap}>
        {/* Two-half card: name on white, the big bot on black (no photos yet) */}
        <View style={[styles.hero, styles.colNarrow]}>
          <View style={styles.heroTop}>
            <Text style={staffText.label}>Since {date(person.created_at, true)}</Text>
            <Text style={styles.heroName}>{person.display_name}</Text>
            <Text style={staffText.note}>{person.paired ? 'Phone paired' : 'Phone not paired yet'}</Text>
          </View>
          <View style={styles.heroBottom}>
            <BotMark size={150} light />
          </View>
        </View>

        <Card title="Last 7 days" style={styles.colWide}>
          <Week week={week} />
          <Text style={staffText.note}>
            {week.last_talk ? `Last talk with Hilo ${date(week.last_talk)}, ${clock(week.last_talk)}` : 'No talk yet'}
          </Text>
        </Card>
      </View>

      <View style={styles.wrap}>
        <Card title="Signals today" icon={<BellIcon />} count={alerts.length} style={styles.colHalf}>
          {alerts.length ? (
            alerts.map((a) => (
              <Text key={a.kind} style={styles.big}>
                {signalText(a)}
              </Text>
            ))
          ) : (
            <Text style={styles.big}>No alerts today</Text>
          )}
        </Card>

        <Card title="Pills · 7 days" icon={<PillIcon />} style={styles.colHalf}>
          {due ? (
            <>
              <Text style={styles.huge}>{Math.round((taken / due) * 100)} %</Text>
              <Text style={staffText.note}>
                {taken} of {due} doses confirmed
              </Text>
              <View style={styles.pillRows}>
                {week.days
                  .filter((d) => d.due)
                  .slice(-3)
                  .reverse()
                  .map((d) => (
                    <View key={d.day} style={styles.pillRow}>
                      <Text style={styles.pillMark}>{d.taken >= d.due ? '✓' : '○'}</Text>
                      <Text style={styles.pillText}>
                        {weekday(d.day)} {dayNum(d.day)} · {d.taken} of {d.due}
                      </Text>
                    </View>
                  ))}
              </View>
            </>
          ) : (
            <Text style={styles.big}>No pills set up</Text>
          )}
        </Card>
      </View>

      <Card title="Family" icon={<FamilyIcon />}>
        {family.length ? (
          <View style={styles.familyRow}>
            {family.map((f) => (
              <View key={f.id} style={styles.member}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberInitial}>{f.display_name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <Text style={styles.memberName}>{f.display_name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.big}>No family in Hilo</Text>
        )}
        <Text style={staffText.note}>
          {week.last_call ? `Last family call ${date(week.last_call)}` : 'No family call yet'} · {callsWeek} this week
        </Text>
      </Card>

      <Card title="Team notes" icon={<NoteIcon />}>
        {notes.length ? (
          notes.map((n) => (
            <View key={n.id} style={styles.note}>
              <Text style={staffText.note}>
                {date(n.created_at)}, {clock(n.created_at)} · {n.by}
              </Text>
              <Text style={staffText.body}>{n.note || 'Done, no note'}</Text>
            </View>
          ))
        ) : (
          <Text style={staffText.note}>Notes saved with &ldquo;Save · done&rdquo; on Today show up here.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Back() {
  return (
    <Link href="/staff" style={styles.back}>
      ← Today
    </Link>
  );
}

function Card({
  title,
  icon,
  count,
  style,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  style?: object;
  children: ReactNode;
}) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHead}>
        {icon ? <View style={styles.cardIcon}>{icon}</View> : null}
        <Text style={styles.cardTitle}>{title}</Text>
        {count ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Seven columns: talked (black dot), pills (taken/due), family call (small dot). */
function Week({ week }: { week: PersonWeek }) {
  return (
    <View style={styles.week}>
      {week.days.map((d) => (
        <View key={d.day} style={styles.weekDay}>
          <Text style={staffText.note}>{weekday(d.day)}</Text>
          <View style={[styles.talkDot, d.talks > 0 && styles.talkDotOn]}>
            <Text style={[styles.talkNum, d.talks > 0 && styles.talkNumOn]}>{dayNum(d.day)}</Text>
          </View>
          <Text style={styles.weekSmall}>{d.due ? `${d.taken}/${d.due}` : '–'}</Text>
          <View style={[styles.callDot, d.calls > 0 && styles.callDotOn]} />
        </View>
      ))}
      <View style={styles.legend}>
        <Text style={styles.weekSmall}>● talked · pills · ● family call</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: staffColors.page },
  content: { paddingTop: 40, paddingHorizontal: 56, paddingBottom: 64, gap: 24, maxWidth: 1320 },
  back: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted, alignSelf: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' },
  colNarrow: { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  colWide: { flexGrow: 2, flexShrink: 1, flexBasis: 480, minWidth: 0 },
  colHalf: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0 },
  hero: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#ececec' },
  heroTop: { padding: 24, gap: 8, backgroundColor: '#fff' },
  heroName: { fontFamily: staffFont, fontSize: 40, fontWeight: '300', letterSpacing: -1.2, color: staffColors.ink },
  heroBottom: { backgroundColor: staffColors.ink, height: 200, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 24, borderWidth: 1, borderColor: '#ececec', padding: 24, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 99,
    backgroundColor: staffColors.active,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  count: {
    minWidth: 28,
    height: 28,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: { fontFamily: staffFont, fontSize: 13, color: '#fff' },
  big: { fontFamily: staffFont, fontSize: 19, lineHeight: 26, color: staffColors.ink },
  huge: { fontFamily: staffFont, fontSize: 52, fontWeight: '500', letterSpacing: -1.8, color: staffColors.ink },
  pillRows: { gap: 6, marginTop: 4 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillMark: { width: 18, fontFamily: staffFont, fontSize: 16, color: staffColors.ink },
  pillText: { fontFamily: staffFont, fontSize: 15, color: staffColors.soft },
  familyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: staffColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { fontFamily: staffFont, fontSize: 16, fontWeight: '700', color: '#fff' },
  memberName: { fontFamily: staffFont, fontSize: 17, fontWeight: '500', color: staffColors.ink },
  note: { gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#ececec' },
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weekDay: { flexGrow: 1, flexBasis: 48, alignItems: 'center', gap: 8 },
  talkDot: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: staffColors.block,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkDotOn: { backgroundColor: staffColors.ink },
  talkNum: { fontFamily: staffFont, fontSize: 15, color: staffColors.muted },
  talkNumOn: { color: '#fff' },
  weekSmall: { fontFamily: staffFont, fontSize: 12, color: staffColors.muted },
  callDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: staffColors.block },
  callDotOn: { backgroundColor: staffColors.ink },
  legend: { width: '100%', marginTop: 4 },
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
