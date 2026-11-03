import { FunctionsHttpError } from '@supabase/supabase-js';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayDot } from '@/components/day-dot';
import { BotFace, ChatIcon, PhoneIcon, PillIcon, StoryIcon } from '@/components/icons';
import { ListRow } from '@/components/list-row';
import { PressScale } from '@/components/press-scale';
import { loadTodayDoses, TodayPills } from '@/components/today-pills';
import { WeekStrip } from '@/components/week-strip';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadCalls, loadMonth, type MemberCalls } from '@/lib/calls';
import { registerFamilyPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { localNow, showTime } from '@/lib/time';
import { colors, family, fontWeight, spacing } from '@/theme';

type Senior = { id: string; display_name: string; talk_time: string | null; user_id: string | null; timezone: string };

type Talk = { started_at: string; ended_at: string | null; family_note: string | null };

/** "De qué hablar con ella" is fresh for this long, then it's old news (as it was in Charlas) */
const NOTE_MS = 3 * 86_400_000;
/** The small podium on Hoy, left to right: second, first, third (sizes from the canvas design) */
const MINI_PODIUM = [
  { rank: 2, avatar: 44, bar: 56, fill: '#d6d6d6' },
  { rank: 1, avatar: 52, bar: 84, fill: colors.ink },
  { rank: 3, avatar: 40, bar: 40, fill: '#e6e6e6' },
] as const;

/** Pills taken today as a ring, like the activity rings */
function PillsRing({ taken, total }: { taken: number; total: number }) {
  const r = 34;
  const length = 2 * Math.PI * r;
  return (
    <Svg width={84} height={84} viewBox="0 0 84 84">
      <Circle cx={42} cy={42} r={r} fill="none" stroke="#dcdcdc" strokeWidth={10} />
      {taken ? (
        <Circle
          cx={42}
          cy={42}
          r={r}
          fill="none"
          stroke={colors.ink}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${(length * taken) / total} ${length}`}
          transform="rotate(-90 42 42)"
        />
      ) : null}
      <SvgText x={42} y={49} textAnchor="middle" fill={colors.ink} fontSize={22} fontWeight="800">
        {`${taken}/${total}`}
      </SvgText>
    </Svg>
  );
}


const text = t.today;
/** Same as quiet-alert: after this, "llama" becomes one of the things to do */
const CALL_DAYS = 3;

/** Her talks today, in her time zone. The latest one first */
const talkedToday = (talks: Talk[], timeZone: string) => {
  const today = localNow(timeZone).date;
  return talks.filter((t) => localNow(timeZone, new Date(t.started_at)).date === today);
};

/**
 * Hoy: how the senior's day is going.
 * Talk time, phone connected and today's pills; stories come next.
 */
export default function TodayScreen() {
  const [senior, setSenior] = useState<Senior | null>(null);
  const [talks, setTalks] = useState<Talk[]>([]);
  // Stories from her talks waiting for the family, newest first
  const [drafts, setDrafts] = useState<{ id: string; title: string; created_at: string }[]>([]);
  // For the sentence at the top: who is reading, her pills today, and what to talk about with her
  const [me, setMe] = useState('');
  const [pills, setPills] = useState<{ taken: number; total: number; next: string | null } | null>(null);
  // Tapping the pills widget opens today's list under it
  const [pillsOpen, setPillsOpen] = useState(false);
  const [month, setMonth] = useState<MemberCalls[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Nobody in the family has talked with her for CALL_DAYS: one of the things to do today
  const [callDue, setCallDue] = useState(false);
  // "Llamar ahora": what happened when it was pressed (the Edge Function ring makes her phone ring)
  const [ring, setRing] = useState<'ringing' | 'tooSoon' | 'noPhone' | 'failed' | null>(null);
  const ringNote = { ringing: text.ringing, tooSoon: text.ringTooSoon, noPhone: text.ringNoPhone, failed: text.ringFailed };
  const callNow = async () => {
    setRing('ringing');
    const { error: e } = await supabase.functions.invoke('ring');
    // It rang: after the ring time, the same note the server gives for the next half hour
    if (!e) return void setTimeout(() => setRing('tooSoon'), 30000);
    const status = e instanceof FunctionsHttpError ? e.context.status : 0;
    setRing(status === 429 ? 'tooSoon' : status === 409 ? 'noPhone' : 'failed');
  };

  // So the server can tell this phone when she hasn't talked in 2 days
  useEffect(() => {
    registerFamilyPush();
  }, []);

  // Until her first talk: a short checklist instead of empty screens (null once she has talked)
  const [firstDay, setFirstDay] = useState<{ pills: boolean; family: boolean } | null>(null);
  // Pull to refresh; the key also reloads the week and the pills, which load on their own
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('people')
      .select('id, display_name, talk_time, user_id, timezone')
      .eq('role', 'senior')
      .limit(1)
      .maybeSingle();
    if (e) return setError(t.common.loadFailed);
    setError(null);
    setSenior(data as Senior | null);
    if (!data) return;
    const { data: session } = await supabase.auth.getSession();
    const [{ data: rows }, { data: stories }, calls, { count: everTalked }, { count: meds }, { count: members }, { data: mine }, doses, monthCalls] =
      await Promise.all([
        // Enough to cover today even with several talks
        supabase
          .from('talk_sessions')
          .select('started_at, ended_at, family_note')
          .eq('person_id', data.id)
          .order('started_at', { ascending: false })
          .limit(10),
        supabase
          .from('chapters')
          .select('id, title, created_at')
          .eq('person_id', data.id)
          .eq('status', 'draft')
          .order('created_at', { ascending: false }),
        data.user_id ? loadCalls(data.id, 1) : Promise.resolve(null),
        supabase.from('talk_sessions').select('id', { count: 'exact', head: true }).eq('person_id', data.id),
        supabase.from('medications').select('id', { count: 'exact', head: true }).eq('person_id', data.id).eq('active', true),
        supabase.from('people').select('id', { count: 'exact', head: true }).eq('role', 'member'),
        supabase.from('people').select('display_name').eq('user_id', session.session?.user.id ?? '').maybeSingle(),
        loadTodayDoses(data.id, data.timezone).catch(() => null),
        loadMonth(data.id, data.timezone).catch(() => []),
      ]);
    setTalks(talkedToday(rows ?? [], data.timezone));
    setMe(mine?.display_name ?? '');
    setPills(
      doses?.length
        ? { taken: doses.filter((d) => d.takenAt).length, total: doses.length, next: doses.find((d) => !d.takenAt)?.time ?? null }
        : null,
    );
    setMonth(monthCalls);
    setNote((rows ?? []).find((r) => r.family_note && Date.now() - Date.parse(r.started_at) < NOTE_MS)?.family_note ?? null);
    setDrafts(stories ?? []);
    // Same rule as the evening nudge: 3 days since the last call (or since her phone was connected)
    setCallDue(Boolean(calls && (!calls.length || Date.now() - Date.parse(calls[0].at) >= CALL_DAYS * 86_400_000)));
    setFirstDay(everTalked ? null : { pills: Boolean(meds), family: (members ?? 0) > 1 });
  }, []);

  // Reload when coming back to the tab, e.g. after pairing their phone
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setReloadKey((k) => k + 1);
    setRefreshing(false);
  };

  const pair = () =>
    senior && router.push({ pathname: '/onboarding/pair', params: { seniorId: senior.id, seniorName: senior.display_name } });

  const lastTalk = talks[0];
  // The day in one sentence: talked (or not yet), pills, new stories, joined like a person would say it
  const now = new Date();
  const parts = senior
    ? [
        {
          icon: ChatIcon,
          words: lastTalk
            ? text.sumTalked(senior.display_name, localNow(senior.timezone, new Date(lastTalk.started_at)).time.replace(/^0/, ''))
            : text.sumNotYet(senior.display_name),
        },
        ...(pills ? [{ icon: PillIcon, words: text.sumPills(pills.taken, pills.total) }] : []),
        ...(() => {
          const today = localNow(senior.timezone).date;
          const n = drafts.filter((d) => localNow(senior.timezone, new Date(d.created_at)).date === today).length;
          return n ? [{ icon: StoryIcon, words: text.sumStories(n) }] : [];
        })(),
      ]
    : [];
  const weekday = now.toLocaleDateString(dateLocale, { weekday: 'short' }).replace('.', '');
  const ringing = ring === 'ringing' || ring === 'tooSoon';
  const ranked = month.filter((m) => m.count > 0).slice(0, 3);
  const leader = ranked[0] ? text.podiumLeader(ranked[0].mine ? null : ranked[0].name, t.talks.callCount(ranked[0].count)) : '';
  const addPills = () =>
    senior &&
    router.push({ pathname: '/onboarding/pills', params: { seniorId: senior.id, seniorName: senior.display_name, from: 'today' } });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView
          contentContainerStyle={styles.screen}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />}>
          {/* The day, like a calendar widget: short weekday, a dot, the date */}
          <View style={styles.head}>
            <View style={styles.dayRow}>
              <Text
                style={styles.weekday}
                accessibilityRole="header"
                accessibilityLabel={now.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}>
                {weekday.charAt(0).toUpperCase() + weekday.slice(1)}
              </Text>
              <View style={styles.dot} />
            </View>
            <Text style={styles.date}>
              {now.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' })}
              {'\n'}
              {now.getFullYear()}
            </Text>
          </View>
          {senior ? (
            <Text style={styles.summary}>
              {text.hello(now.getHours())}
              {me ? (
                <>
                  {', '}
                  <Text style={styles.strong}>{me}</Text>
                </>
              ) : null}
              {'. '}
              {parts.map(({ icon: Icon, words: [before, bold, after] }, i) => (
                <Text key={bold}>
                  {i === 0 ? '' : i === parts.length - 1 ? text.sumAnd : ', '}
                  {before}
                  <Text style={styles.strong}>
                    <Icon />
                    {` ${bold}`}
                  </Text>
                  {after}
                </Text>
              ))}
              {'.'}
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {senior ? (
            <View style={styles.list}>
              {/* Her week first, like a calendar */}
              <WeekStrip key={reloadKey} seniorId={senior.id} timezone={senior.timezone} />
              {/* What to talk about with her, and Hilo rings on her phone (it has to be connected) */}
              {note || senior.user_id ? (
                // Without a note there's nothing to frame: just the black call button
                <View style={note ? styles.talkCard : styles.talkPlain}>
                  {note ? (
                    <>
                      <Text style={styles.talkLabel}>{t.talks.noteLabel(senior.display_name)}</Text>
                      <Text style={styles.talkNote}>{note}</Text>
                    </>
                  ) : null}
                  {/* Nobody in the family has called her for days: said right where the fix is */}
                  {senior.user_id && callDue && !ring ? (
                    <Text style={[styles.callDue, note && styles.callDueOnInk]}>{text.callDue(senior.display_name)}</Text>
                  ) : null}
                  {senior.user_id ? (
                    ring && ring !== 'noPhone' && ring !== 'failed' ? (
                      <View style={[styles.ringState, !note && styles.ringStatePlain]} accessibilityLiveRegion="polite">
                        {ring === 'ringing' ? <View style={styles.dot} /> : null}
                        <Text style={[styles.ringStateText, !note && styles.ringStateTextPlain]}>{ringNote[ring]}</Text>
                      </View>
                    ) : (
                      <>
                        <PressScale
                          onPress={ringing ? undefined : callNow}
                          accessibilityRole="button"
                          accessibilityLabel={text.ring(senior.display_name)}
                          accessibilityHint={text.ringHint}
                          style={[styles.ringButton, !note && styles.ringButtonPlain]}>
                          <PhoneIcon color={note ? colors.ink : colors.onAccent} />
                          <Text style={[styles.ringLabel, !note && styles.ringLabelPlain]}>{text.ring(senior.display_name)}</Text>
                        </PressScale>
                        {ring ? <Text style={[styles.ringFailed, !note && styles.failed]}>{ringNote[ring]}</Text> : null}
                      </>
                    )
                  ) : null}
                </View>
              ) : null}
              {/* Without her phone Hilo can't talk with her or ring: the one thing to do (not before her first talk: the checklist has it) */}
              {!senior.user_id && !firstDay ? (
                <View style={styles.phoneCard}>
                  <Text style={styles.phoneTitle}>{text.phoneMissing}</Text>
                  <Text style={styles.phoneBody}>{text.phoneMissingBody(senior.display_name)}</Text>
                  <PressScale onPress={pair} accessibilityRole="button" style={[styles.ringButton, styles.ringButtonPlain]}>
                    <Text style={[styles.ringLabel, styles.ringLabelPlain]}>{text.connect}</Text>
                  </PressScale>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Widgets: her pills today, her book, and who talks most with her this month */}
          {senior ? (
            <View style={styles.widgets}>
              <View style={styles.widgetSlot}>
              <PressScale
                onPress={pills ? () => setPillsOpen((o) => !o) : addPills}
                accessibilityRole="button"
                accessibilityLabel={pills ? t.todayPills.summary(pills.taken, pills.total) : t.todayPills.add}
                accessibilityState={pills ? { expanded: pillsOpen } : undefined}
                style={[styles.widget, styles.widgetGrey]}>
                <Text style={styles.widgetLabel}>{t.todayPills.title}</Text>
                {pills ? (
                  <>
                    <PillsRing taken={pills.taken} total={pills.total} />
                    <Text style={styles.widgetLine}>
                      {pills.next ? text.pillsLeft(showTime(pills.next)) : text.pillsAllTaken}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.widgetLine}>{t.todayPills.add}</Text>
                )}
              </PressScale>
              </View>
              <View style={styles.widgetSlot}>
              <PressScale
                onPress={() => router.push('/family/book')}
                accessibilityRole="button"
                accessibilityLabel={drafts.length ? `${text.bookWidget}, ${text.toReview(drafts.length)}` : text.bookWidget}
                style={[styles.widget, styles.widgetBlack]}>
                <Text style={[styles.widgetLabel, styles.widgetLabelOnInk]}>{text.bookWidget}</Text>
                {drafts.length ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{text.toReview(drafts.length)}</Text>
                  </View>
                ) : null}
                <View style={styles.widgetBot}>
                  <BotFace size={140} />
                </View>
              </PressScale>
              </View>
            </View>
          ) : null}
          {senior && pills && pillsOpen ? (
            <TodayPills key={reloadKey} seniorId={senior.id} seniorName={senior.display_name} timezone={senior.timezone} />
          ) : null}

          {/* A podium only when two people have called her this month */}
          {senior && ranked.length >= 2 ? (
            <PressScale
              onPress={() => router.push('/family/talks')}
              accessibilityRole="button"
              accessibilityLabel={`${text.podiumTitle(senior.display_name)}. ${leader}`}
              style={styles.podiumCard}>
              <View style={styles.podiumHead}>
                <Text style={styles.widgetLabel}>{text.podiumTitle(senior.display_name)}</Text>
                <Text style={styles.widgetLabel}>›</Text>
              </View>
              <View style={styles.podium}>
                {MINI_PODIUM.map((place) => {
                  const m = ranked[place.rank - 1];
                  if (!m) return <View key={place.rank} style={styles.place} />;
                  const first = place.rank === 1;
                  return (
                    <View key={place.rank} style={styles.place}>
                      <View
                        style={[
                          styles.podiumAvatar,
                          { width: place.avatar, height: place.avatar, borderRadius: place.avatar / 2, backgroundColor: place.fill },
                        ]}>
                        <Text style={[styles.podiumInitial, first && styles.onInk]}>{m.name.trim().charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.podiumBar, { height: place.bar, backgroundColor: place.fill }]}>
                        <Text style={[styles.podiumRank, first && styles.onInk]}>{place.rank}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.podiumLeader}>{leader}</Text>
            </PressScale>
          ) : null}

          {/* Before her first talk: the few steps that make Hilo work, ticked as they are done */}
          {senior && firstDay ? (
            <View style={styles.list}>
              <Text style={styles.label}>{text.firstDay.toUpperCase()}</Text>
              <ListRow left={<DayDot state="done" size={40} />} title={text.stepAccount} />
              <ListRow
                left={<DayDot state={senior.user_id ? 'done' : 'now'} size={40} />}
                title={text.stepPhone(senior.display_name)}
                onPress={senior.user_id ? undefined : pair}
              />
              <ListRow
                left={<DayDot state={firstDay.pills ? 'done' : 'later'} size={40} />}
                title={text.stepPills}
                detail={firstDay.pills ? undefined : text.optional}
                onPress={
                  firstDay.pills
                    ? undefined
                    : () =>
                        router.push({
                          pathname: '/onboarding/pills',
                          params: { seniorId: senior.id, seniorName: senior.display_name, from: 'today' },
                        })
                }
              />
              <ListRow
                left={<DayDot state={firstDay.family ? 'done' : 'later'} size={40} />}
                title={text.stepFamily}
                detail={firstDay.family ? undefined : text.optional}
                onPress={firstDay.family ? undefined : () => router.push('/invite')}
              />
              <Text style={styles.note}>{text.firstDayHint(senior.display_name)}</Text>
            </View>
          ) : null}

        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 48,
    gap: 28,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weekday: {
    fontSize: 44,
    fontWeight: fontWeight.heavy,
    letterSpacing: -1,
    color: colors.ink,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.nudge,
  },
  date: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  summary: {
    marginTop: -12,
    paddingHorizontal: 8,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
    color: colors.muted,
  },
  strong: {
    color: colors.ink,
  },
  talkCard: {
    gap: 14,
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.ink,
  },
  talkLabel: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#b3b3b3',
  },
  talkNote: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    color: colors.onAccent,
  },
  ringButton: {
    minHeight: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  talkPlain: {
    gap: 8,
  },
  ringButtonPlain: {
    minHeight: family.size.buttonHeight,
    borderRadius: family.size.buttonRadius,
    backgroundColor: colors.ink,
  },
  ringLabelPlain: {
    color: colors.onAccent,
  },
  ringStatePlain: {
    minHeight: family.size.buttonHeight,
    borderRadius: family.size.buttonRadius,
    backgroundColor: colors.surface,
  },
  ringStateTextPlain: {
    color: colors.ink,
  },
  callDue: {
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.nudge,
  },
  callDueOnInk: {
    paddingHorizontal: 0,
    color: '#ff9f8a',
  },
  phoneCard: {
    gap: 8,
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  phoneTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  phoneBody: {
    marginBottom: 6,
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  ringLabel: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  ringState: {
    minHeight: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2c2c2e',
  },
  ringStateText: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: '#e5e5ea',
  },
  ringFailed: {
    textAlign: 'center',
    fontSize: family.fontSize.note,
    fontWeight: fontWeight.semibold,
    color: '#ff9f8a',
  },
  widgets: {
    flexDirection: 'row',
    gap: 14,
  },
  // Same width each, whatever their text
  widgetSlot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  widget: {
    height: 196,
    padding: 18,
    borderRadius: 28,
    overflow: 'hidden',
  },
  widgetGrey: {
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  widgetBlack: {
    backgroundColor: colors.ink,
  },
  widgetLabel: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#555555',
  },
  widgetLabelOnInk: {
    color: '#b3b3b3',
  },
  widgetLine: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: '#ff6a3d',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  widgetBot: {
    position: 'absolute',
    left: 20,
    bottom: -58,
  },
  podiumCard: {
    gap: 16,
    padding: 20,
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  podiumHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  place: {
    width: 92,
    alignItems: 'center',
    gap: 8,
  },
  podiumAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumInitial: {
    fontSize: 17,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  podiumBar: {
    width: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: {
    fontSize: 18,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  onInk: {
    color: colors.onAccent,
  },
  podiumLeader: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: '#3a3a3c',
  },
  list: {
    gap: 10,
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  ring: {
    marginVertical: 8,
    gap: 8,
  },
  center: {
    textAlign: 'center',
  },
  failed: {
    color: colors.error,
  },
  label: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    color: colors.error,
    fontWeight: '600',
    textAlign: 'center',
  },
});
