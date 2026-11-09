import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { CrownIcon } from '@/components/icons';
import { ListRow } from '@/components/list-row';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { dayLabel, iCalled, loadMonth, type MemberCalls } from '@/lib/calls';
import { loadMessages, markMessagesRead, type FamilyMessage } from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import { colors, family, fontWeight, spacing } from '@/theme';

const text = t.talks;

type Senior = { id: string; display_name: string; timezone: string };

/** Same as quiet-alert: after this long without a call, the row asks for one */
const CALL_DAYS = 3;

/** The podium, left to right: second, first, third. Sizes from the canvas design. */
const PLACES = [
  { rank: 2, width: 104, avatar: 60, bar: 118, fill: '#d6d6d6' },
  { rank: 1, width: 112, avatar: 72, bar: 166, fill: colors.ink },
  { rank: 3, width: 104, avatar: 54, bar: 84, fill: '#e6e6e6' },
] as const;

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

/**
 * Familia (the file keeps the old Charlas name, so the "llama a la abuela" push still opens it):
 * who has talked with her this month, as a podium, and "He hablado hoy con…".
 */
export default function FamilyScreen() {
  const [senior, setSenior] = useState<Senior | null>(null);
  const [members, setMembers] = useState<MemberCalls[]>([]);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // When the data was loaded: "a call today?" is decided against this, not during render
  const [loadedAt, setLoadedAt] = useState(0);

  const load = useCallback(
    () =>
      supabase
        .from('people')
        .select('id, display_name, timezone')
        .eq('role', 'senior')
        .limit(1)
        .maybeSingle()
        .then(async ({ data, error: e }) => {
          if (e) return setError(t.common.loadFailed);
          setError(null);
          setSenior(data as Senior | null);
          if (!data) return;
          const [month, sent] = await Promise.all([loadMonth(data.id, data.timezone), loadMessages(data.id).catch(() => [])]);
          setMembers(month);
          setMessages(sent);
          setLoadedAt(Date.now());
          // Shown once as new (the dot), then read: the badge clears on the next tab change
          if (sent.some((m) => m.unread)) markMessagesRead(data.id).catch(() => {});
        }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Load at start too, so this tab is ready before it's opened
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
      setMembers(await loadMonth(senior.id, senior.timezone));
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

  const name = senior.display_name;
  const month = new Date().toLocaleDateString(dateLocale, { month: 'long', timeZone: senior.timezone });
  const [before, count, after] = text.month(
    month,
    members.reduce((n, m) => n + m.count, 0),
    name,
  );
  const me = members.find((m) => m.mine);
  const calledToday = Boolean(me?.last && dayLabel(me.last.at, senior.timezone) === text.today);
  // A podium only makes sense with two people on it
  const ranked = members.filter((m) => m.count > 0).slice(0, 3);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <WideFrame>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.screen}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />}>
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {text.title}
            </Text>
            <Text style={styles.month}>
              {before}
              <Text style={styles.monthCount}>{count}</Text>
              {after}
            </Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {messages.length ? (
            <View style={[styles.card, styles.list]}>
              <Text style={styles.label}>{text.messagesLabel(name).toUpperCase()}</Text>
              {messages.map((m, i) => (
                <View key={m.id} style={[styles.message, i > 0 && styles.rowLine]}>
                  <Text style={[styles.messageBody, m.kind === 'alert' && styles.alert]}>
                    {m.kind === 'alert' ? `${text.alert}: ` : ''}«{m.body}»
                  </Text>
                  <Text style={styles.rowDetail}>
                    {m.unread ? <Text style={styles.nudge}>● </Text> : null}
                    {dayLabel(m.at, senior.timezone)} ·{' '}
                    {new Date(m.at).toLocaleTimeString(dateLocale, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: senior.timezone,
                    })}{' '}
                    · {m.forEveryone ? text.forEveryone : text.forYou}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {ranked.length >= 2 ? (
            <View style={styles.card}>
              <View style={styles.podium}>
                {PLACES.map((place) => {
                  const m = ranked[place.rank - 1];
                  if (!m) return <View key={place.rank} style={{ width: place.width }} />;
                  const first = place.rank === 1;
                  return (
                    <View
                      key={place.rank}
                      style={[styles.place, { width: place.width }]}
                      accessible
                      accessibilityLabel={`${place.rank}. ${m.mine ? text.you : m.name}, ${text.callCount(m.count)}`}>
                      {first ? <CrownIcon color={colors.nudge} /> : null}
                      <View
                        style={[
                          styles.avatar,
                          {
                            width: place.avatar,
                            height: place.avatar,
                            borderRadius: place.avatar / 2,
                            backgroundColor: place.fill,
                          },
                        ]}>
                        <Text style={[styles.avatarText, { fontSize: place.avatar * 0.36 }, first && styles.onInk]}>
                          {initial(m.name)}
                        </Text>
                      </View>
                      <Text style={[styles.placeName, first && styles.placeNameFirst]} numberOfLines={1}>
                        {m.mine ? text.you : m.name}
                      </Text>
                      {/* Pill bars, as on the canvas design */}
                      <View style={[styles.bar, { height: place.bar, backgroundColor: place.fill }]}>
                        <Text style={[styles.rank, first && styles.rankFirst, first && styles.onInk]}>{place.rank}</Text>
                        <Text style={[styles.barCount, first && styles.barCountFirst]}>{text.callCount(m.count)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={[styles.card, styles.list]}>
            {members.map((m, i) => {
              const quiet = !m.last || loadedAt - Date.parse(m.last.at) >= CALL_DAYS * 86_400_000;
              const detail = m.last
                ? dayLabel(m.last.at, senior.timezone) + (m.last.source === 'talk' ? ` · ${text.toldHilo(name)}` : '')
                : text.noCallsMonth;
              const top = i === 0 && m.count > 0;
              return (
                <View key={m.name + i} style={[styles.row, i > 0 && styles.rowLine]}>
                  <View style={[styles.rowAvatar, top && styles.rowAvatarTop]}>
                    <Text style={[styles.rowInitial, top && styles.onInk]}>{initial(m.name)}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{m.mine ? `${m.name} (${text.you.toLowerCase()})` : m.name}</Text>
                    <Text style={styles.rowDetail}>
                      {detail}
                      {quiet ? <Text style={styles.nudge}>{` · ${text.nudge}`}</Text> : null}
                    </Text>
                  </View>
                  <Text style={styles.rowCount}>{m.count}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <BigButton
              scale="family"
              variant={calledToday ? 'outline' : 'fill'}
              label={calledToday ? text.calledDone : text.calledButton(name)}
              onPress={calledToday ? undefined : called}
            />
            <Text style={styles.note}>{text.countsHint(name)}</Text>
            <Text style={styles.note}>{text.callsHint}</Text>
          </View>

          <ListRow title={t.settings.invite} onPress={() => router.push('/invite')} />
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
    paddingTop: spacing.screenTop + spacing.tabsTop,
    paddingBottom: 48,
    gap: 14,
  },
  head: {
    gap: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 44,
    fontWeight: fontWeight.heavy,
    letterSpacing: -1,
    color: colors.ink,
  },
  month: {
    fontSize: 25,
    lineHeight: 33,
    fontWeight: fontWeight.semibold,
    letterSpacing: -0.3,
    color: colors.muted,
  },
  monthCount: {
    color: colors.ink,
  },
  card: {
    borderRadius: 28,
    backgroundColor: colors.surface,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  place: {
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  onInk: {
    color: colors.onAccent,
  },
  placeName: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  placeNameFirst: {
    fontSize: 17,
    fontWeight: fontWeight.heavy,
  },
  bar: {
    width: '100%',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rank: {
    fontSize: 28,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  rankFirst: {
    fontSize: 38,
  },
  barCount: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: '#3a3a3c',
  },
  barCountFirst: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#d1d1d6',
  },
  list: {
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  label: {
    paddingTop: 12,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  message: {
    gap: 4,
    paddingVertical: 14,
  },
  messageBody: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  alert: {
    color: colors.error,
  },
  rowLine: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6e6e6',
  },
  rowAvatarTop: {
    backgroundColor: colors.ink,
  },
  rowInitial: {
    fontSize: 16,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 17,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  rowDetail: {
    fontSize: 14,
    color: colors.muted,
  },
  nudge: {
    fontWeight: fontWeight.semibold,
    color: colors.nudge,
  },
  rowCount: {
    fontSize: 20,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  actions: {
    gap: 10,
  },
  note: {
    paddingHorizontal: 8,
    fontSize: family.fontSize.note,
    lineHeight: 21,
    color: colors.muted,
  },
  error: {
    fontSize: family.fontSize.note,
    color: colors.error,
    fontWeight: '600',
    textAlign: 'center',
  },
});
