import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { WideFrame } from '@/components/wide-split';
import { dateLocale, t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { remindLater } from '@/lib/reminders';
import { loadSeniorDay, type SeniorMe } from '@/lib/senior-day';
import { useWide } from '@/lib/layout';
import { localNow, showTime, type Dose } from '@/lib/time';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const pillLarge = require('../../../assets/icons/pill-large.svg');

/** How long "Recuérdamelo en un rato" waits */
const SNOOZE_MINUTES = 30;

/** "Domingo 11 de octubre" / "Zondag 11 oktober": the month stays in lower case */
function todayLabel() {
  const text = new Date().toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(',', '');
}

type DayPill = Dose & { snoozedUntil?: string };

/** 'HH:mm' a number of minutes from now, in the senior's time zone */
const inMinutes = (timeZone: string, minutes: number) => localNow(timeZone, new Date(Date.now() + minutes * 60_000)).time;

/**
 * One thing at a time: the pill that is due now, a big button,
 * and the whole day below as a thread.
 */
export default function PillsScreen() {
  const [me, setMe] = useState<SeniorMe | null>(null);
  const [pills, setPills] = useState<DayPill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  // iPad on its side: the bot on the left, the pills on the right (so no second bot in the column)
  const wide = useWide();
  // Same size as the bot on the home
  const botSize = Math.min(size.bot, width * 0.7, height * 0.28);
  // The pill circle is smaller: with the day list below, the screen must fit without scrolling
  const circleSize = Math.min(size.bot, width * 0.5, height * 0.2);
  const timezone = me?.timezone ?? 'Europe/Madrid';
  const now = localNow(timezone).time;

  // The senior's own schedule and today's confirmations
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const day = await loadSeniorDay();
        if (!day.me) return setError(day.error);
        setError(null);
        setMe(day.me);
        setPills(day.doses);
      })();
    }, []),
  );

  // After marking, "Deshacer" stays for 5 seconds in case of a wrong tap
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const update = (key: string, changes: Partial<DayPill>) =>
    setPills((list) => list && list.map((p) => (p.key === key ? { ...p, ...changes } : p)));

  const list = pills ?? [];
  const pending = list.filter((p) => !p.takenAt);
  const due = pending.find((p) => p.time <= now && !(p.snoozedUntil && p.snoozedUntil > now));
  const next = pending.find((p) => p.time > now);
  const undoPill = list.find((p) => p.key === undoId);

  const markTaken = async (dose: DayPill) => {
    if (!me) return;
    setError(null);
    update(dose.key, { takenAt: now, snoozedUntil: undefined });
    setUndoId(dose.key);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoId(null), 5000);

    const { data, error: e } = await supabase
      .from('medication_events')
      .upsert(
        {
          family_id: me.family_id,
          medication_id: dose.medicationId,
          scheduled_date: localNow(me.timezone).date,
          scheduled_time: dose.time,
          status: 'taken',
          confirmed_at: new Date().toISOString(),
          confirmed_by: me.id,
          source: 'app',
        },
        { onConflict: 'medication_id,scheduled_date,scheduled_time' },
      )
      .select('id')
      .single();
    if (e || !data) {
      update(dose.key, { takenAt: null });
      setUndoId(null);
      setError(t.common.saveFailed);
      return;
    }
    update(dose.key, { eventId: data.id });
  };

  // Only on this phone: the reminder comes back in a while
  const snooze = (dose: DayPill) => {
    update(dose.key, { snoozedUntil: inMinutes(timezone, SNOOZE_MINUTES) });
    remindLater(dose.name, SNOOZE_MINUTES);
  };

  const undo = async (dose: DayPill) => {
    setUndoId(null);
    update(dose.key, { takenAt: null, eventId: null });
    if (!dose.eventId) return;
    const { error: e } = await supabase.from('medication_events').delete().eq('id', dose.eventId);
    if (e) {
      update(dose.key, { takenAt: dose.takenAt, eventId: dose.eventId });
      setError(t.pills.undoFailed);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} bounces={false}>
          <ScreenHeader backLabel={t.home.title} title={t.home.pills} subtitle={todayLabel()} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Fills the space between the header and the day, so nothing is left blank at the bottom */}
          <View style={styles.stage}>
            <Animated.View layout={LinearTransition.duration(250)} style={styles.focus}>
              {!pills ? null : list.length === 0 ? (
                <>
                  {wide ? null : (
                    <View style={styles.botWrap}>
                      <Bot size={botSize} />
                    </View>
                  )}
                  <Text style={styles.focusName}>{t.pills.noneToday}</Text>
                  <Text style={styles.focusDetail}>{t.pills.noneTodayDetail}</Text>
                </>
              ) : due ? (
                <>
                  <View style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
                    <Image source={pillLarge} style={styles.icon} contentFit="contain" />
                  </View>
                  <Text style={styles.kicker}>{t.pills.dueNow}</Text>
                  <Text style={styles.focusName}>{due.name}</Text>
                  <Text style={styles.focusDetail}>{t.pills.theOneAt(showTime(due.time))}</Text>
                </>
              ) : pending.length === 0 ? (
                <>
                  {wide ? null : (
                    <View style={styles.botWrap}>
                      <Bot size={botSize} />
                    </View>
                  )}
                  <Text style={styles.focusName}>{t.pills.allDone}</Text>
                  <Text style={styles.focusDetail}>{t.pills.allDoneDetail}</Text>
                </>
              ) : (
                <>
                  <View style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2 }]}>
                    <Image source={pillLarge} style={[styles.icon, styles.iconLater]} contentFit="contain" />
                  </View>
                  <Text style={styles.kicker}>{t.pills.noneNow}</Text>
                  {next ? (
                    <Text style={styles.focusDetail}>{t.pills.nextOne(next.name, showTime(next.time))}</Text>
                  ) : (
                    <Text style={styles.focusDetail}>{t.pills.remindSoon}</Text>
                  )}
                </>
              )}
            </Animated.View>

            <View style={styles.actions}>
              {undoPill ? (
                <View style={styles.undoRow}>
                  <Text style={styles.undoText}>{t.pills.doneName(undoPill.name)}</Text>
                  <Pressable
                    onPress={() => undo(undoPill)}
                    accessibilityRole="button"
                    accessibilityLabel={t.pills.undoA11y}
                    hitSlop={12}>
                    <Text style={styles.undoLink}>{t.pills.undo}</Text>
                  </Pressable>
                </View>
              ) : null}
              {due ? (
                <>
                  <BigButton label={t.pills.taken} onPress={() => markTaken(due)} />
                  <Pressable onPress={() => snooze(due)} accessibilityRole="button" hitSlop={8} style={styles.later}>
                    <Text style={styles.laterText}>{t.pills.later}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          <Text style={styles.dayLabel}>{t.pills.yourDay}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadScroll}>
            <View style={styles.thread}>
              <View style={styles.threadLine} />
              {list.map((p) => {
                const isNow = p.key === due?.key;
                const done = !!p.takenAt;
                return (
                  <View
                    key={p.key}
                    style={styles.stop}
                    accessible
                    accessibilityLabel={`${p.name}, ${done ? t.pills.takenAt(showTime(p.takenAt!)) : isNow ? t.pills.now.toLowerCase() : t.pills.at(showTime(p.time))}`}>
                    <View style={[styles.dot, done && styles.dotDone, isNow && styles.dotNow]}>
                      {done ? <Text style={styles.tick}>✓</Text> : null}
                    </View>
                    <Text style={[styles.stopName, isNow && styles.stopNameNow, !done && !isNow && styles.mutedText]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={[styles.stopTime, isNow && styles.stopTimeNow]}>
                      {done ? showTime(p.takenAt!) : isNow ? t.pills.now : showTime(p.time)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const DOT = 34;
const STOP_WIDTH = 112;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  stage: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  error: {
    marginTop: 18,
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
    textAlign: 'center',
  },
  focus: {
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    flexShrink: 0,
    backgroundColor: 'rgba(143, 168, 138, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  // Same gap below the bot as below the pill circle
  botWrap: {
    flexShrink: 0,
    marginBottom: 22,
  },
  icon: {
    width: size.pillIconLarge + 11,
    height: size.pillIconLarge + 11,
  },
  iconLater: {
    opacity: 0.4,
  },
  kicker: {
    fontSize: 22,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
  focusName: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
    textAlign: 'center',
  },
  focusDetail: {
    fontSize: fontSize.status,
    lineHeight: 28,
    color: '#555555',
    textAlign: 'center',
  },
  undoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  undoText: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  undoLink: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: 30,
    gap: 6,
  },
  later: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  laterText: {
    fontSize: fontSize.status,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  dayLabel: {
    marginTop: 12,
    marginBottom: 16,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.muted,
  },
  threadScroll: {
    flexGrow: 1,
  },
  thread: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  // The thread runs from the first dot to the last one
  threadLine: {
    position: 'absolute',
    top: DOT / 2 - 1.5,
    left: STOP_WIDTH / 2,
    right: STOP_WIDTH / 2,
    height: 3,
    backgroundColor: colors.sageSoft,
  },
  stop: {
    flexGrow: 1,
    width: STOP_WIDTH,
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  dot: {
    flexShrink: 0,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    borderColor: colors.sageSoft,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    borderColor: colors.sage,
    backgroundColor: colors.sage,
  },
  dotNow: {
    borderWidth: 4,
    borderColor: colors.sage,
  },
  tick: {
    fontSize: 18,
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  stopName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  stopNameNow: {
    fontWeight: fontWeight.heavy,
  },
  mutedText: {
    color: colors.muted,
  },
  stopTime: {
    fontSize: 15,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  stopTimeNow: {
    color: colors.ink,
    fontWeight: fontWeight.semibold,
  },
});
