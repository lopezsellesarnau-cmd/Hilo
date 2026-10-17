import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { CheckIcon, PillIllustration } from '@/components/icons';
import { ScreenHeader } from '@/components/screen-header';
import { WideFrame } from '@/components/wide-split';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { remindLater } from '@/lib/reminders';
import { loadSeniorDay, type SeniorMe } from '@/lib/senior-day';
import { useWide } from '@/lib/layout';
import { localNow, showTime, type Dose } from '@/lib/time';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** How long "Hecho" and "Deshacer" stay after marking, in case of a wrong tap */
const UNDO_MS = 10_000;

/** How long "Recuérdamelo en un rato" waits */
const SNOOZE_MINUTES = 30;

type DayPill = Dose & { snoozedUntil?: string };

/** 'HH:mm' a number of minutes from now, in the senior's time zone */
const inMinutes = (timeZone: string, minutes: number) => localNow(timeZone, new Date(Date.now() + minutes * 60_000)).time;

/**
 * One thing at a time (18 oct prototype): the day as three big dots at the top,
 * the pill that is due now in the middle, two big buttons at the bottom.
 */
export default function PillsScreen() {
  const [me, setMe] = useState<SeniorMe | null>(null);
  const [pills, setPills] = useState<DayPill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  // iPad on its side: the bot on the left, the pills on the right (so no second bot in the column)
  const wide = useWide();
  const doneBotSize = Math.min(170, width * 0.45, height * 0.2);
  // The screen must fit without scrolling with the dots above and the buttons below
  const pillSize = Math.min(150, width * 0.38, height * 0.18);
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

  // After marking, "Hecho" and "Deshacer" stay for a while in case of a wrong tap
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
    undoTimer.current = setTimeout(() => setUndoId(null), UNDO_MS);

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

  const taken = list.filter((p) => p.takenAt).length;
  const doneView = undoPill ? (
    <>
      {wide ? null : (
        <View style={styles.botWrap}>
          <Bot size={doneBotSize} />
        </View>
      )}
      <Text style={styles.doneTitle}>{t.pills.doneName(undoPill.name)}</Text>
      <Text style={styles.focusDetail}>
        {next ? t.pills.nextOne(next.name, showTime(next.time)) : pending.length === 0 ? t.pills.allDoneDetail : t.pills.remindSoon}
      </Text>
    </>
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <WideFrame>
        <ScrollView contentContainerStyle={styles.screen} bounces={false}>
          <View style={styles.top}>
            <ScreenHeader backLabel={t.home.title} />
            {list.length ? <Text style={styles.count}>{t.pills.countToday(taken, list.length)}</Text> : null}
          </View>
          <Text accessibilityRole="header" style={styles.srOnly}>
            {t.home.pills}
          </Text>

          {/* The day as big dots: done, now, later */}
          {list.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
              {list.map((p) => {
                const isNow = p.key === due?.key;
                const done = !!p.takenAt;
                return (
                  <View
                    key={p.key}
                    style={[styles.stop, list.length <= 3 && styles.stopFill]}
                    accessible
                    accessibilityLabel={`${p.name}, ${done ? t.pills.takenAt(showTime(p.takenAt!)) : isNow ? t.pills.now.toLowerCase() : t.pills.at(showTime(p.time))}`}>
                    <View style={[styles.dot, done && styles.dotDone, isNow && styles.dotNow]}>
                      {done ? <CheckIcon /> : isNow ? <View style={styles.dotCore} /> : null}
                    </View>
                    <Text style={[styles.stopText, isNow && styles.stopTextNow]} numberOfLines={2}>
                      {`${showTime(done ? p.takenAt! : p.time)} · ${done ? t.pills.takenShort : isNow ? t.pills.now : t.pills.laterShort}`}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Animated.View
            key={undoPill ? `done-${undoPill.key}` : (due?.key ?? (pending.length ? 'later' : 'all'))}
            entering={FadeIn.duration(350)}
            style={styles.focus}
            accessibilityLiveRegion="polite">
            {!pills ? null : doneView ? (
              doneView
            ) : list.length === 0 ? (
              <>
                {wide ? null : (
                  <View style={styles.botWrap}>
                    <Bot size={doneBotSize} />
                  </View>
                )}
                <Text style={styles.focusName}>{t.pills.noneToday}</Text>
                <Text style={styles.focusDetail}>{t.pills.noneTodayDetail}</Text>
              </>
            ) : due ? (
              <>
                <PillIllustration size={pillSize} />
                <Text style={styles.kicker}>{t.pills.dueNow.toUpperCase()}</Text>
                <Text style={styles.focusName}>{due.name}</Text>
                <Text style={styles.focusDetail}>{t.pills.theOneAt(showTime(due.time))}</Text>
              </>
            ) : pending.length === 0 ? (
              <>
                {wide ? null : (
                  <View style={styles.botWrap}>
                    <Bot size={doneBotSize} />
                  </View>
                )}
                <Text style={styles.focusName}>{t.pills.allDone}</Text>
                <Text style={styles.focusDetail}>{t.pills.allDoneDetail}</Text>
              </>
            ) : (
              <>
                <View style={styles.later}>
                  <PillIllustration size={pillSize} />
                </View>
                <Text style={styles.kicker}>{t.pills.noneNow.toUpperCase()}</Text>
                <Text style={styles.focusDetail}>
                  {next ? t.pills.nextOne(next.name, showTime(next.time)) : t.pills.remindSoon}
                </Text>
              </>
            )}
          </Animated.View>

          <Animated.View layout={LinearTransition.duration(250)} entering={FadeInDown.duration(400).delay(150)} style={styles.actions}>
            {undoPill ? (
              <>
                <BigButton variant="outline" label={t.pills.undoA11y} onPress={() => undo(undoPill)} />
                <BigButton label={t.talk.backHome} onPress={() => router.back()} />
              </>
            ) : due ? (
              <>
                <BigButton label={t.pills.taken} onPress={() => markTaken(due)} />
                <BigButton variant="outline" label={t.pills.later} onPress={() => snooze(due)} />
              </>
            ) : null}
          </Animated.View>
        </ScrollView>
      </WideFrame>
    </SafeAreaView>
  );
}

const DOT = 64;

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
  // Back button on the left, today's count on the right
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  count: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  error: {
    marginTop: 18,
    fontSize: fontSize.label,
    lineHeight: 24,
    fontWeight: fontWeight.semibold,
    color: '#b3261e',
    textAlign: 'center',
  },
  dayScroll: {
    flexGrow: 1,
    gap: 8,
    paddingTop: 8,
  },
  stop: {
    width: 112,
    alignItems: 'center',
    gap: 8,
  },
  // Three or fewer: they share the width, like the prototype
  stopFill: {
    flex: 1,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#a0a0a0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    borderStyle: 'solid',
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  dotNow: {
    borderStyle: 'solid',
    borderWidth: 6,
    borderColor: colors.accent,
  },
  dotCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
  },
  stopText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stopTextNow: {
    fontWeight: fontWeight.heavy,
    color: colors.ink,
  },
  focus: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 24,
  },
  botWrap: {
    marginBottom: 14,
  },
  later: {
    opacity: 0.35,
  },
  kicker: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.4,
    color: colors.muted,
    textAlign: 'center',
  },
  focusName: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: fontWeight.bold,
    letterSpacing: -1,
    color: colors.ink,
    textAlign: 'center',
  },
  doneTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  focusDetail: {
    marginTop: 4,
    fontSize: 21,
    lineHeight: 28,
    color: '#4a4a4a',
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
});
