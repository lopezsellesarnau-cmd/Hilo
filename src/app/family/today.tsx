import { FunctionsHttpError } from '@supabase/supabase-js';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayDot } from '@/components/day-dot';
import { ChatIcon, PhoneIcon, PillIcon, StoryIcon } from '@/components/icons';
import { ListRow } from '@/components/list-row';
import { PressScale } from '@/components/press-scale';
import { loadTodayDoses, TodayPills } from '@/components/today-pills';
import { WeekStrip } from '@/components/week-strip';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { loadCalls } from '@/lib/calls';
import { registerFamilyPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
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
  const [talks, setTalks] = useState<Talk[]>([]);
  // Stories from her talks waiting for the family, newest first
  const [drafts, setDrafts] = useState<{ id: string; title: string; created_at: string }[]>([]);
  // For the sentence at the top: who is reading, her pills today, and what to talk about with her
  const [me, setMe] = useState('');
  const [pills, setPills] = useState<{ taken: number; total: number } | null>(null);
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
    const [{ data: rows }, { data: stories }, calls, { count: everTalked }, { count: meds }, { count: members }, { data: mine }, doses] =
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
      ]);
    setTalks(talkedToday(rows ?? [], data.timezone));
    setMe(mine?.display_name ?? '');
    setPills(doses?.length ? { taken: doses.filter((d) => d.takenAt).length, total: doses.length } : null);
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
              {/* What to talk about with her, and Hilo rings on her phone (it has to be connected) */}
              {note || senior.user_id ? (
                <View style={styles.talkCard}>
                  {note ? (
                    <>
                      <Text style={styles.talkLabel}>{t.talks.noteLabel(senior.display_name)}</Text>
                      <Text style={styles.talkNote}>{note}</Text>
                    </>
                  ) : null}
                  {senior.user_id ? (
                    ring && ring !== 'noPhone' && ring !== 'failed' ? (
                      <View style={styles.ringState} accessibilityLiveRegion="polite">
                        {ring === 'ringing' ? <View style={styles.dot} /> : null}
                        <Text style={styles.ringStateText}>{ringNote[ring]}</Text>
                      </View>
                    ) : (
                      <>
                        <PressScale
                          onPress={ringing ? undefined : callNow}
                          accessibilityRole="button"
                          accessibilityLabel={text.ring(senior.display_name)}
                          accessibilityHint={text.ringHint}
                          style={styles.ringButton}>
                          <PhoneIcon color={colors.ink} />
                          <Text style={styles.ringLabel}>{text.ring(senior.display_name)}</Text>
                        </PressScale>
                        {ring ? <Text style={styles.ringFailed}>{ringNote[ring]}</Text> : null}
                      </>
                    )
                  ) : null}
                </View>
              ) : null}
              <WeekStrip key={reloadKey} seniorId={senior.id} timezone={senior.timezone} />
            </View>
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

          {/* Only what needs the family today; nothing when all is well */}
          {senior && !firstDay && (!senior.user_id || drafts.length || callDue) ? (
            <View style={styles.list}>
              <Text style={styles.label}>{text.toDo.toUpperCase()}</Text>
              {!senior.user_id ? (
                <ListRow
                  left={<DayDot state="now" size={40} />}
                  title={text.phoneMissing}
                  detail={text.phoneMissingBody(senior.display_name)}
                  onPress={pair}
                  accessibilityLabel={text.connect}
                />
              ) : null}
              {drafts.length ? (
                <ListRow
                  kicker={(drafts.length === 1 ? text.story : text.stories(drafts.length)).toUpperCase()}
                  title={text.quoted(drafts[0].title)}
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: drafts[0].id } })}
                  accessibilityLabel={`${text.review}: ${drafts[0].title}`}
                />
              ) : null}
              {callDue ? (
                <ListRow
                  kicker={text.callKicker.toUpperCase()}
                  title={text.callDue(senior.display_name)}
                  onPress={() => router.push('/family/talks')}
                />
              ) : null}
            </View>
          ) : null}

          {senior ? (
            <View>
              <TodayPills key={reloadKey} seniorId={senior.id} seniorName={senior.display_name} timezone={senior.timezone} />
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
