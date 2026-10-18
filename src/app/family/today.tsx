import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bot } from '@/components/bot';
import { DayDot } from '@/components/day-dot';
import { ListRow } from '@/components/list-row';
import { TodayPills } from '@/components/today-pills';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { registerFamilyPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { localNow } from '@/lib/time';
import { colors, family, fontWeight, spacing } from '@/theme';

type Senior = { id: string; display_name: string; talk_time: string | null; user_id: string | null; timezone: string };

/** '10:00:00' → '10:00' */
const showTime = (t: string) => t.slice(0, 5).replace(/^0/, '');

type Talk = { started_at: string; ended_at: string | null };

const text = t.today;

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
  const [drafts, setDrafts] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // So the server can tell this phone when she hasn't talked in 2 days
  useEffect(() => {
    registerFamilyPush();
  }, []);

  // Reload when coming back to the tab, e.g. after pairing their phone
  useFocusEffect(
    useCallback(() => {
      supabase
        .from('people')
        .select('id, display_name, talk_time, user_id, timezone')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(({ data, error: e }) => {
          if (e) {
            setError(t.common.loadFailed);
            return;
          }
          setError(null);
          setSenior(data as Senior | null);
          if (!data) return;
          // Enough to cover today even with several talks
          supabase
            .from('talk_sessions')
            .select('started_at, ended_at')
            .eq('person_id', data.id)
            .order('started_at', { ascending: false })
            .limit(10)
            .then(({ data: rows }) => setTalks(talkedToday(rows ?? [], data.timezone)));
          supabase
            .from('chapters')
            .select('id, title')
            .eq('person_id', data.id)
            .eq('status', 'draft')
            .order('created_at', { ascending: false })
            .then(({ data: rows }) => setDrafts(rows ?? []));
        });
    }, []),
  );

  const pair = () =>
    senior && router.push({ pathname: '/onboarding/pair', params: { seniorId: senior.id, seniorName: senior.display_name } });

  const lastTalk = talks[0];
  const talkTitle =
    senior && lastTalk
      ? text.talked(
          localNow(senior.timezone, new Date(lastTalk.started_at)).time.replace(/^0/, ''),
          lastTalk.ended_at
            ? Math.max(1, Math.round((Date.parse(lastTalk.ended_at) - Date.parse(lastTalk.started_at)) / 60_000))
            : null,
          talks.length,
        )
      : text.notYetTitle;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* iPad on its side: the bot on the left, this column on the right */}
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen}>
          {/* Like the senior's Home: the bot and a centred title */}
          <Animated.View entering={FadeIn.duration(400)} style={styles.head}>
            <Bot size={84} look="left" />
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            {senior ? <Text style={styles.subtitle}>{text.with(senior.display_name)}</Text> : null}
          </Animated.View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {senior ? (
            <Animated.View entering={FadeInDown.duration(400).delay(80)} style={styles.list}>
              {/* The one thing a son or daughter opens the app for: black, first */}
              <ListRow
                dark
                kicker={text.talk.toUpperCase()}
                title={talkTitle}
                detail={!lastTalk && senior.talk_time ? text.talkAt(showTime(senior.talk_time)) : undefined}
              />

              {drafts.length ? (
                <ListRow
                  kicker={(drafts.length === 1 ? text.story : text.stories(drafts.length)).toUpperCase()}
                  title={text.quoted(drafts[0].title)}
                  onPress={() => router.push({ pathname: '/review/[id]', params: { id: drafts[0].id } })}
                  accessibilityLabel={`${text.review}: ${drafts[0].title}`}
                />
              ) : null}

              {senior.user_id ? (
                <ListRow left={<DayDot state="done" size={40} />} title={text.phone} detail={text.phoneOk} />
              ) : (
                <ListRow
                  left={<DayDot state="now" size={40} />}
                  title={text.phoneMissing}
                  detail={text.phoneMissingBody(senior.display_name)}
                  onPress={pair}
                  accessibilityLabel={text.connect}
                />
              )}
            </Animated.View>
          ) : null}

          {senior ? (
            <Animated.View entering={FadeInDown.duration(400).delay(160)}>
              <TodayPills seniorId={senior.id} seniorName={senior.display_name} timezone={senior.timezone} />
            </Animated.View>
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
  error: {
    fontSize: family.fontSize.note,
    color: '#b3261e',
    fontWeight: '600',
    textAlign: 'center',
  },
});
