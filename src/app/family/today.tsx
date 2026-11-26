import { FunctionsHttpError } from '@supabase/supabase-js';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayDot } from '@/components/day-dot';
import { LiveBot, useFinger } from '@/components/live-bot';
import { GearIcon, PhoneIcon } from '@/components/icons';
import { ListRow } from '@/components/list-row';
import { PressScale } from '@/components/press-scale';
import { loadTodayDoses, TodayPills } from '@/components/today-pills';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadCalls, loadMonth, type MemberCalls } from '@/lib/calls';
import { registerFamilyPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { localNow, showTime } from '@/lib/time';
import { flapText, loadVisits, type Visit } from '@/lib/visits';
import { SplitFlap } from '@/components/split-flap';
import { colors, family, fontWeight, spacing } from '@/theme';

type Senior = { id: string; display_name: string; talk_time: string | null; user_id: string | null; timezone: string };

type Talk = { started_at: string; ended_at: string | null; family_note: string | null };

/** "De qué hablar con ella" is fresh for this long, then it's old news (as it was in Charlas) */
const NOTE_MS = 3 * 86_400_000;

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
  // Her Bot looks at your finger anywhere on the screen
  const { finger, handlers } = useFinger();
  const [talks, setTalks] = useState<Talk[]>([]);
  // Stories from her talks waiting for the family, newest first
  const [drafts, setDrafts] = useState<{ id: string; title: string; created_at: string }[]>([]);
  // For the sentence at the top: who is reading, her pills today, and what to talk about with her
  const [, setMe] = useState('');
  const [pills, setPills] = useState<{ taken: number; total: number; next: string | null } | null>(null);
  // Tapping the pills widget opens today's list under it
  const [pillsOpen, setPillsOpen] = useState(false);
  const [, setMonth] = useState<MemberCalls[]>([]);
  const [note, setNote] = useState<string | null>(null);
  // Her next medical visit, if it's within two weeks: the split-flap board
  const [visit, setVisit] = useState<Visit | null>(null);
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
    loadVisits(data.id)
      .then((v) => setVisit(v.find((x) => Date.parse(x.startsAt) > Date.now() && Date.parse(x.startsAt) - Date.now() < 14 * 86_400_000) ?? null))
      .catch(() => {});
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
  const weekday = now.toLocaleDateString(dateLocale, { weekday: 'short' }).replace('.', '');
  const ringing = ring === 'ringing' || ring === 'tooSoon';
  const addPills = () =>
    senior &&
    router.push({ pathname: '/onboarding/pills', params: { seniorId: senior.id, seniorName: senior.display_name, from: 'today' } });

  const talkedAt = lastTalk ? localNow(senior?.timezone ?? 'UTC', new Date(lastTalk.started_at)).time.replace(/^0/, '') : null;
  const canCall = Boolean(senior?.user_id);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']} {...handlers}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={v2.screen}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />}>
          {/* v2: the day, her name, Call and Ajustes on one line */}
          <View style={v2.top}>
            <Text style={v2.day} accessibilityRole="header" accessibilityLabel={now.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}>
              {weekday.charAt(0).toUpperCase() + weekday.slice(1)} {now.getDate()}
            </Text>
            <View style={v2.topRight}>
              {senior ? (
                <View style={v2.name}>
                  <Text style={v2.nameText} numberOfLines={1}>{senior.display_name}</Text>
                </View>
              ) : null}
              {/* Always there: without her phone connected yet, it says so instead of hiding */}
              {senior ? (
                <PressScale
                  onPress={ringing ? undefined : canCall ? callNow : () => setRing('noPhone')}
                  accessibilityRole="button"
                  accessibilityLabel={text.ring(senior.display_name)}
                  accessibilityHint={text.ringHint}
                  style={[v2.call, (ringing || !canCall) && v2.callOff]}>
                  <PhoneIcon size={16} color={colors.onAccent} />
                  <Text style={v2.callText}>{text.call}</Text>
                </PressScale>
              ) : null}
              <PressScale onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel={t.settings.title} hitSlop={8} style={styles.gear}>
                <GearIcon size={22} color={colors.ink} />
              </PressScale>
            </View>
          </View>
          {ring ? (
            <Text style={v2.ringNote} accessibilityLiveRegion="polite">
              {ringNote[ring]}
            </Text>
          ) : senior && canCall && callDue ? (
            <Text style={v2.ringNote}>{text.callDue(senior.display_name)}</Text>
          ) : null}

          {/* Her Bot: big, its eyes follow your finger on the screen */}
          {senior ? (
            <View style={v2.bot}>
              <LiveBot size={128} finger={finger} />
            </View>
          ) : null}

          {senior ? (
            <>
              <Text style={v2.big} accessibilityRole="header" adjustsFontSizeToFit numberOfLines={2}>
                {talkedAt ? text.headTalked(talkedAt) : text.headNotYet}
              </Text>
              {!talkedAt && senior.talk_time ? <Text style={v2.sub}>{text.subNotYet(showTime(senior.talk_time))}</Text> : null}
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* What to talk about with her */}
          {senior && note ? (
            <View style={v2.note}>
              <Text style={v2.noteLabel}>{t.talks.noteLabel(senior.display_name)}</Text>
              <Text style={v2.noteText}>{note}</Text>
            </View>
          ) : null}

          {/* Her pills today: one capsule per dose, filled when taken. Tap for the list. */}
          {senior ? (
            <PressScale
              onPress={pills ? () => setPillsOpen((o) => !o) : addPills}
              accessibilityRole="button"
              accessibilityLabel={pills ? t.todayPills.summary(pills.taken, pills.total) : t.todayPills.add}
              accessibilityState={pills ? { expanded: pillsOpen } : undefined}
              style={v2.pills}>
              <View>
                <Text style={v2.label}>{t.todayPills.title}</Text>
                {pills ? (
                  <View style={v2.caps}>
                    {Array.from({ length: Math.min(pills.total, 6) }, (_, i) => (
                      <View key={i} style={[v2.cap, i < pills.taken ? v2.capOn : v2.capOff]} />
                    ))}
                  </View>
                ) : (
                  <Text style={v2.addPills}>{t.todayPills.add}</Text>
                )}
              </View>
              {pills ? (
                <View style={v2.pillsRight}>
                  <Text style={v2.count}>
                    {pills.taken}/{pills.total}
                  </Text>
                  <Text style={v2.next}>{pills.next ? text.pillsLeft(showTime(pills.next)) : text.pillsAllTaken}</Text>
                </View>
              ) : null}
            </PressScale>
          ) : null}
          {senior && pills && pillsOpen ? (
            <TodayPills key={reloadKey} seniorId={senior.id} seniorName={senior.display_name} timezone={senior.timezone} />
          ) : null}

          {/* Her next visit, like a departure board; tap for all of them */}
          {senior && visit ? (
            <PressScale onPress={() => router.push('/visits')} accessibilityRole="button" style={v2.visit}>
              <Text style={v2.label}>{visit.title.toUpperCase()}</Text>
              <View style={v2.flap}>
                <SplitFlap value={flapText(visit.startsAt, senior.timezone)} length={9} size={40} />
              </View>
            </PressScale>
          ) : null}

          {/* New stories for the family to read */}
          {senior && drafts.length ? (
            <PressScale onPress={() => router.push('/family/book')} accessibilityRole="button" accessibilityLabel={`${text.bookWidget}, ${text.toReview(drafts.length)}`} style={v2.stories}>
              <Text style={v2.storiesText}>{text.toReview(drafts.length)}</Text>
              <Text style={v2.storiesText}>›</Text>
            </PressScale>
          ) : null}

          {/* Without her phone Hilo can't talk with her or ring: the one thing to do (not before her first talk: the checklist has it) */}
          {senior && !senior.user_id && !firstDay ? (
            <View style={styles.phoneCard}>
              <Text style={styles.phoneTitle}>{text.phoneMissing}</Text>
              <Text style={styles.phoneBody}>{text.phoneMissingBody(senior.display_name)}</Text>
              <PressScale onPress={pair} accessibilityRole="button" style={[styles.ringButton, styles.ringButtonPlain]}>
                <Text style={[styles.ringLabel, styles.ringLabelPlain]}>{text.connect}</Text>
              </PressScale>
            </View>
          ) : null}

          {/* Before her first talk: the few steps that make Hilo work, ticked as they are done */}
          {senior && firstDay ? (
            <View style={[styles.list, v2.after]}>
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
                onPress={firstDay.pills ? undefined : addPills}
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

/** v2 (25 nov 2026): bold type, few words. Black, white and greys. */
const v2 = StyleSheet.create({
  screen: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 48, gap: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { fontSize: 17, fontWeight: fontWeight.semibold, color: colors.muted },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: colors.surface, maxWidth: 140 },
  nameText: { fontSize: 16, fontWeight: fontWeight.semibold, color: colors.ink },
  call: { height: 44, borderRadius: 22, paddingLeft: 14, paddingRight: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.ink },
  callOff: { opacity: 0.4 },
  callText: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.onAccent },
  ringNote: { marginTop: 10, fontSize: 15, fontWeight: fontWeight.semibold, color: colors.ink, textAlign: 'right' },
  bot: { marginTop: 28, alignItems: 'flex-start' },
  big: { marginTop: 20, fontSize: 64, lineHeight: 62, fontWeight: fontWeight.bold, letterSpacing: -3, color: colors.ink },
  sub: { marginTop: 10, fontSize: 18, fontWeight: fontWeight.semibold, color: colors.muted },
  note: { marginTop: 28, borderRadius: 28, padding: 20, backgroundColor: colors.surface },
  noteLabel: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  noteText: { marginTop: 6, fontSize: 22, lineHeight: 27, fontWeight: fontWeight.bold, letterSpacing: -0.5, color: colors.ink },
  pills: { marginTop: 28, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  caps: { marginTop: 12, flexDirection: 'row', gap: 8 },
  cap: { width: 52, height: 28, borderRadius: 14 },
  capOn: { backgroundColor: colors.ink },
  capOff: { borderWidth: 3, borderColor: 'rgba(0,0,0,0.14)' },
  addPills: { marginTop: 8, fontSize: 22, fontWeight: fontWeight.bold, color: colors.ink },
  pillsRight: { alignItems: 'flex-end' },
  count: { fontSize: 40, lineHeight: 42, fontWeight: fontWeight.bold, letterSpacing: -1.5, color: colors.ink },
  next: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.muted },
  stories: { marginTop: 24, height: 64, borderRadius: 32, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink },
  after: { marginTop: 36 },
  visit: { marginTop: 28 },
  flap: { marginTop: 10 },
  storiesText: { fontSize: 19, fontWeight: fontWeight.bold, color: colors.onAccent },
});

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
    paddingTop: spacing.screenTop + spacing.tabsTop,
    paddingBottom: 48,
    gap: 28,
  },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
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
