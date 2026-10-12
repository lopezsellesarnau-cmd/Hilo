import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { samplePills, type Pill } from '@/data/sample';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const pillLarge = require('../../../assets/icons/pill-large.svg');

/** How long "Recuérdamelo en un rato" waits */
const SNOOZE_MINUTES = 30;

const pad = (n: number) => String(n).padStart(2, '0');
const toHHmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** '09:15' → '9:15' */
const showTime = (t: string) => t.replace(/^0/, '');

/** "Domingo 11 de octubre": Spanish writes the month in lower case */
function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(',', '');
}

type DayPill = Pill & { snoozedUntil?: string };

/**
 * One thing at a time: the pill that is due now, a big button,
 * and the whole day below as a thread.
 */
export default function PillsScreen() {
  const [pills, setPills] = useState<DayPill[]>(samplePills);
  const fade = useScrollFade();
  const now = toHHmm(new Date());

  // After marking, "Deshacer" stays for 5 seconds in case of a wrong tap
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const update = (id: string, changes: Partial<DayPill>) =>
    setPills((list) => list.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const pending = pills.filter((p) => !p.takenAt);
  const due = pending.find((p) => p.time <= now && !(p.snoozedUntil && p.snoozedUntil > now));
  const next = pending.find((p) => p.time > now);
  const undoPill = pills.find((p) => p.id === undoId);

  const markTaken = (id: string) => {
    update(id, { takenAt: toHHmm(new Date()), snoozedUntil: undefined });
    setUndoId(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoId(null), 5000);
  };

  const snooze = (id: string) =>
    update(id, { snoozedUntil: toHHmm(new Date(Date.now() + SNOOZE_MINUTES * 60_000)) });

  const undo = (id: string) => {
    update(id, { takenAt: null });
    setUndoId(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
        <ScreenHeader backLabel="Inicio" title="Mis pastillas" subtitle={todayLabel()} />

        <View style={styles.focus}>
          {due ? (
            <>
              <View style={styles.iconCircle}>
                <Image source={pillLarge} style={styles.icon} contentFit="contain" />
              </View>
              <Text style={styles.kicker}>Ahora te toca</Text>
              <Text style={styles.focusName}>{due.name}</Text>
              <Text style={styles.focusDetail}>La de las {showTime(due.time)}</Text>
            </>
          ) : pending.length === 0 ? (
            <>
              <Bot size={168} mood="speaking" />
              <Text style={styles.focusName}>¡Todo hecho por hoy!</Text>
              <Text style={styles.focusDetail}>Te has tomado todas las pastillas.</Text>
            </>
          ) : (
            <>
              <View style={styles.iconCircle}>
                <Image source={pillLarge} style={[styles.icon, styles.iconLater]} contentFit="contain" />
              </View>
              <Text style={styles.kicker}>Ahora no te toca ninguna</Text>
              {next ? (
                <Text style={styles.focusDetail}>
                  La siguiente es {next.name.toLowerCase()}, a las {showTime(next.time)}. Te aviso.
                </Text>
              ) : (
                <Text style={styles.focusDetail}>Te lo recuerdo en un rato.</Text>
              )}
            </>
          )}
        </View>

        {undoPill ? (
          <View style={styles.undoRow}>
            <Text style={styles.undoText}>Hecho: {undoPill.name.toLowerCase()}.</Text>
            <Pressable
              onPress={() => undo(undoPill.id)}
              accessibilityRole="button"
              accessibilityLabel="Deshacer, no la he tomado"
              hitSlop={12}>
              <Text style={styles.undoLink}>Deshacer</Text>
            </Pressable>
          </View>
        ) : null}

        {due ? (
          <View style={styles.actions}>
            <BigButton label="Ya me la he tomado" onPress={() => markTaken(due.id)} />
            <Pressable onPress={() => snooze(due.id)} accessibilityRole="button" hitSlop={8} style={styles.later}>
              <Text style={styles.laterText}>Recuérdamelo en un rato</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.dayLabel}>TU DÍA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.threadScroll}>
          <View style={styles.thread}>
            <View style={styles.threadLine} />
            {pills.map((p) => {
              const isNow = p.id === due?.id;
              const done = !!p.takenAt;
              return (
                <View
                  key={p.id}
                  style={styles.stop}
                  accessible
                  accessibilityLabel={`${p.name}, ${done ? `tomada a las ${showTime(p.takenAt!)}` : isNow ? 'ahora' : `a las ${showTime(p.time)}`}`}>
                  <View style={[styles.dot, done && styles.dotDone, isNow && styles.dotNow]}>
                    {done ? <Text style={styles.tick}>✓</Text> : null}
                  </View>
                  <Text style={[styles.stopName, isNow && styles.stopNameNow, !done && !isNow && styles.mutedText]} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={[styles.stopTime, isNow && styles.stopTimeNow]}>
                    {done ? showTime(p.takenAt!) : isNow ? 'Ahora' : showTime(p.time)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
      <ScrollFade visible={fade.visible} />
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
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 72,
  },
  focus: {
    alignItems: 'center',
    marginTop: 36,
    gap: 6,
  },
  iconCircle: {
    flexShrink: 0,
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: 'rgba(143, 168, 138, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 38,
    lineHeight: 44,
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
    marginTop: 18,
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
    marginTop: 40,
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
