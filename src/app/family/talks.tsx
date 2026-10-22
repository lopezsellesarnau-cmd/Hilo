import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { ListRow } from '@/components/list-row';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { dayLabel, iCalled, loadCalls, type Call } from '@/lib/calls';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, family, fontWeight, spacing } from '@/theme';

const text = t.talks;

type Senior = { id: string; display_name: string; talk_time: string | null; timezone: string };
type Talk = {
  id: string;
  started_at: string;
  ended_at: string | null;
  chapter: { id: string; title: string } | null;
  /** "De qué hablar con ella": one sentence for the family, when something fitted */
  note: string | null;
};

/** How many of her talks the history shows */
const HISTORY = 14;
/** A talk without an end, started less than this ago, is going on now */
const LIVE_MS = 20 * 60 * 1000;
/** "De qué hablar con ella" is fresh for this long, then it's old news */
const NOTE_MS = 3 * 86_400_000;

const minutes = (talk: Talk) =>
  talk.ended_at ? Math.max(1, Math.round((Date.parse(talk.ended_at) - Date.parse(talk.started_at)) / 60_000)) : null;
/** '10:00:00' → '10:00' */
const showTime = (time: string) => time.slice(0, 5).replace(/^0/, '');

/**
 * Charlas: everything about talking with her. Today's talk, the family's calls ("He hablado hoy con…")
 * and her last talks with the story each one became. Never what she said word for word: that stays hers.
 */
export default function TalksScreen() {
  const [senior, setSenior] = useState<Senior | null>(null);
  const [talks, setTalks] = useState<Talk[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState<string | null>(null);
  // When the data was loaded: "talking now" is decided against this, not during render
  const [loadedAt, setLoadedAt] = useState(0);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      supabase
        .from('people')
        .select('id, display_name, talk_time, timezone')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(async ({ data, error: e }) => {
          if (e) return setError(t.common.loadFailed);
          setError(null);
          setSenior(data as Senior | null);
          if (!data) return;
          const [{ data: rows }, latest] = await Promise.all([
            supabase
              .from('talk_sessions')
              .select('id, started_at, ended_at, family_note, answers, chapters(id, title)')
              .eq('person_id', data.id)
              .order('started_at', { ascending: false })
              .limit(HISTORY * 2),
            loadCalls(data.id),
          ]);
          setCalls(latest);
          setLoadedAt(Date.now());
          setTalks(
            (rows ?? [])
              // Only talks where she answered, not just Hilo's greeting
              .filter((r) => r.answers > 0)
              .slice(0, HISTORY)
              .map((r) => ({
                id: r.id,
                started_at: r.started_at,
                ended_at: r.ended_at,
                chapter: (r.chapters as unknown as { id: string; title: string } | null) ?? null,
                note: r.family_note,
              })),
          );
        }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // The tabs are preloaded (lazy: false): load at start too, so this tab is ready before it's opened
  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const called = async () => {
    if (!senior) return;
    try {
      await iCalled(senior.id);
      setCalls(await loadCalls(senior.id));
    } catch {
      setError(t.common.saveFailed);
    }
  };

  if (!senior) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SafeAreaView>
    );
  }

  const time = (iso: string) => localNow(senior.timezone, new Date(iso)).time.replace(/^0/, '');
  const today = talks.filter((k) => dayLabel(k.started_at, senior.timezone) === text.today);
  const latest = today[0];
  const live = latest && !latest.ended_at && loadedAt - Date.parse(latest.started_at) < LIVE_MS;
  const todayTitle = live
    ? text.liveNow
    : latest
      ? text.talked(time(latest.started_at), minutes(latest), today.length)
      : text.notYet;
  const noted = talks.find((k) => k.note && loadedAt - Date.parse(k.started_at) < NOTE_MS);
  const calledToday = Boolean(calls[0]?.mine && dayLabel(calls[0].at, senior.timezone) === text.today);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView
          contentContainerStyle={styles.screen}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />}>
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            <Text style={styles.subtitle}>{t.today.with(senior.display_name)}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.list}>
            <ListRow
              dark
              kicker={text.todayLabel.toUpperCase()}
              title={todayTitle}
              detail={!latest && senior.talk_time ? t.today.talkAt(showTime(senior.talk_time)) : undefined}
            />
          </View>

          {noted?.note ? (
            <View style={styles.list}>
              <Text style={styles.label}>{text.noteLabel(senior.display_name).toUpperCase()}</Text>
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{noted.note}</Text>
                <Text style={styles.note}>{text.noteWhen(dayLabel(noted.started_at, senior.timezone))}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.list}>
            <Text style={styles.label}>{text.calls.toUpperCase()}</Text>
            <BigButton
              scale="family"
              variant={calledToday ? 'outline' : 'fill'}
              label={calledToday ? text.calledDone : text.calledButton(senior.display_name)}
              onPress={calledToday ? undefined : called}
            />
            {calls.length ? (
              calls.map((c) => (
                <ListRow
                  key={c.at + c.name}
                  title={c.mine ? text.you : c.name}
                  detail={
                    dayLabel(c.at, senior.timezone) + (c.source === 'talk' ? ` · ${text.toldHilo(senior.display_name)}` : '')
                  }
                />
              ))
            ) : (
              <Text style={styles.note}>{text.noCalls(senior.display_name)}</Text>
            )}
            <Text style={styles.note}>{text.callsHint}</Text>
          </View>

          <View style={styles.list}>
            <Text style={styles.label}>{text.history.toUpperCase()}</Text>
            {talks.length ? (
              talks.map((k) => {
                const m = minutes(k);
                const chapter = k.chapter;
                return (
                  <ListRow
                    key={k.id}
                    kicker={dayLabel(k.started_at, senior.timezone).toUpperCase()}
                    title={`${time(k.started_at)}${m !== null ? ` · ${m} min` : ''}`}
                    detail={chapter ? text.story(chapter.title) : undefined}
                    onPress={chapter ? () => router.push({ pathname: '/review/[id]', params: { id: chapter.id } }) : undefined}
                  />
                );
              })
            ) : (
              <Text style={styles.note}>{text.noTalks}</Text>
            )}
          </View>
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
    alignItems: 'center',
  },
  title: {
    marginTop: 14,
    fontSize: 36,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 21,
    fontWeight: fontWeight.regular,
    color: colors.muted,
  },
  list: {
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  noteBox: {
    gap: 8,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  noteText: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    color: colors.ink,
  },
  note: {
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
    textAlign: 'center',
  },
});
