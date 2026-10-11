import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressScale } from '@/components/press-scale';
import { ScreenHeader } from '@/components/screen-header';
import { ScrollFade, useScrollFade } from '@/components/scroll-fade';
import { samplePills, type Pill } from '@/data/sample';
import { colors, fontSize, fontWeight, size, spacing } from '@/theme';

const pillLarge = require('../../assets/icons/pill-large.svg');
const takenIcon = require('../../assets/icons/taken.svg');
const missedIcon = require('../../assets/icons/missed.svg');

const pad = (n: number) => String(n).padStart(2, '0');
const nowHHmm = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "Domingo 11 de octubre": Spanish writes the month in lower case */
function todayLabel() {
  const text = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (text.charAt(0).toUpperCase() + text.slice(1)).replace(',', '');
}

export default function PillsScreen() {
  const [pills, setPills] = useState<Pill[]>(samplePills);
  const fade = useScrollFade();
  const now = nowHHmm();
  const taken = pills.filter((p) => p.takenAt).length;

  // After marking, "Deshacer" stays for 5 seconds in case of a wrong tap
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const setTaken = (id: string, takenAt: string | null) =>
    setPills((list) => list.map((p) => (p.id === id ? { ...p, takenAt } : p)));

  const markTaken = (id: string) => {
    setTaken(id, nowHHmm());
    setUndoId(id);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoId(null), 5000);
  };

  const undo = (id: string) => {
    setTaken(id, null);
    setUndoId(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.screen} {...fade.scrollProps}>
        <ScreenHeader backLabel="Inicio" title="Mis pastillas" subtitle={todayLabel()} />

        <Image source={pillLarge} style={styles.pillIcon} contentFit="contain" />

        <Text style={styles.summary}>
          <Text style={styles.summaryCount}>
            {taken} de {pills.length}
          </Text>{' '}
          pastillas tomadas hoy
        </Text>

        <View style={styles.list}>
          {pills.map((pill) => {
            const due = pill.time <= now;
            return (
              <View key={pill.id} style={styles.item}>
                <Text style={styles.time}>{pill.time}</Text>
                <View style={styles.nameRow}>
                  <View style={styles.bullet} />
                  <View style={styles.nameUnderline}>
                    <Text style={styles.name}>{pill.name}</Text>
                  </View>
                </View>

                {pill.takenAt ? (
                  <>
                    <View style={styles.status}>
                      <Text style={styles.statusText}>Tomada a las {pill.takenAt}</Text>
                      <Image source={takenIcon} style={styles.statusIcon} accessibilityLabel="Tomada" />
                    </View>
                    {undoId === pill.id ? (
                      <Pressable
                        onPress={() => undo(pill.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Deshacer, no la he tomado"
                        hitSlop={12}
                        style={styles.undo}>
                        <Text style={styles.undoText}>Deshacer</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : due ? (
                  <>
                    <View style={styles.status}>
                      <Text style={styles.statusText}>No se ha tomado</Text>
                      <Image source={missedIcon} style={styles.statusIcon} accessibilityLabel="No tomada" />
                    </View>
                    <PressScale
                      onPress={() => markTaken(pill.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Ya me he tomado ${pill.name}`}
                      style={styles.chip}>
                      <Text style={styles.chipText}>✓ Ya la he tomado</Text>
                    </PressScale>
                  </>
                ) : (
                  <View style={styles.status}>
                    <Text style={[styles.statusText, styles.muted]}>Te aviso a su hora</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <ScrollFade visible={fade.visible} />
    </SafeAreaView>
  );
}

const indent = 20;

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
  pillIcon: {
    width: size.pillIconLarge,
    height: size.pillIconLarge,
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 26,
  },
  summary: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    marginBottom: 22,
  },
  summaryCount: {
    fontWeight: fontWeight.heavy,
  },
  list: {
    gap: 30,
  },
  item: {
    gap: 8,
  },
  time: {
    fontSize: fontSize.time,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },
  nameUnderline: {
    flexShrink: 1,
    paddingBottom: 4,
    borderBottomWidth: 3,
    borderBottomColor: colors.ink,
  },
  name: {
    fontSize: fontSize.pillName,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
    marginLeft: indent,
  },
  statusText: {
    fontSize: fontSize.status,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  muted: {
    color: colors.muted,
  },
  statusIcon: {
    width: size.statusIcon,
    height: size.statusIcon,
  },
  // Compact chip: clearly a button, but not a full-width bar (min 48pt touch target)
  chip: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: 10,
    marginLeft: indent,
    paddingHorizontal: 18,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.sage,
    backgroundColor: colors.background,
  },
  chipText: {
    fontSize: fontSize.status,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  undo: {
    alignSelf: 'flex-start',
    marginLeft: indent,
    marginTop: 4,
    paddingVertical: 6,
  },
  undoText: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});
