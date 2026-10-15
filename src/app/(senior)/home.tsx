import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton } from '@/components/big-button';
import { Bot } from '@/components/bot';
import { useWide } from '@/lib/layout';
import { askForReminders, scheduleReminders } from '@/lib/reminders';
import { loadSeniorDay } from '@/lib/senior-day';
import { colors, fontSize, fontWeight, lineHeight, size, spacing } from '@/theme';

const pill = require('../../../assets/icons/pill-small.svg');
const book = require('../../../assets/icons/book.svg');

/** When the app opens: greeting, bot and buttons appear one after another, gently.
 * Skipped automatically when "Reduce Motion" is on. */
const enter = (order: number) => FadeInDown.duration(500).delay(order === 0 ? 0 : 250 + order * 90);

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  // iPad on its side: bot on the left, greeting and buttons on the right (Figma IPAD MINI / DUO 2)
  const wide = useWide();
  // Never a fixed 265: on short screens a fixed bot overlaps the greeting (prototype bug)
  const botSize = wide ? Math.min(360, width * 0.3, height * 0.5) : Math.min(size.bot, width * 0.7, height * 0.28);

  // Name and today's pills, refreshed every time the senior comes back to the home
  const [name, setName] = useState<string | null>(null);
  const [pills, setPills] = useState<{ taken: number; total: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      loadSeniorDay().then((day) => {
        if (!day.me) return;
        setName(day.me.display_name);
        setPills({
          taken: day.doses.filter((d) => d.takenAt).length,
          total: day.doses.length,
        });
        // Picks up any change the family made to the talk time or the pills.
        // Asks first on phones paired before reminders existed (iOS only ever asks once).
        askForReminders().then((ok) => {
          if (ok) scheduleReminders(day.me.talk_time, day.meds);
        });
      });
    }, []),
  );

  const header = (
    <Animated.View entering={enter(0)} accessibilityRole="header" style={styles.header}>
      <Text style={styles.title}>{name ? `¡Hola, ${name}!` : '¡Hola!'}</Text>
      <Text style={styles.subtitle}>¿Cómo estás?</Text>
    </Animated.View>
  );

  const stage = (
    <Animated.View entering={FadeIn.duration(700).delay(150)} style={styles.stage}>
      <Bot size={botSize} mood="idle" />
    </Animated.View>
  );

  const buttons = (
    <View style={styles.buttons}>
      <Animated.View entering={enter(1)}>
        <BigButton label="Hablar" accessibilityHint="Empieza la charla de hoy" onPress={() => router.push('/talk')} />
      </Animated.View>
      <Animated.View entering={enter(2)}>
        <BigButton
          variant="outline"
          label="Mis pastillas"
          detail={pills?.total ? `${pills.taken} de ${pills.total}` : undefined}
          onPress={() => router.push('/pills')}
          icon={<Image source={pill} style={styles.icon} contentFit="contain" />}
        />
      </Animated.View>
      <Animated.View entering={enter(3)}>
        <BigButton
          variant="outline"
          label="Mi libro"
          onPress={() => router.push('/book')}
          icon={<Image source={book} style={styles.bookIcon} contentFit="contain" />}
        />
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.screen, wide && styles.screenWide]} bounces={false}>
        {wide ? (
          <>
            {stage}
            <View style={styles.side}>
              {header}
              {buttons}
            </View>
          </>
        ) : (
          <>
            {header}
            {stage}
            {buttons}
          </>
        )}
      </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: spacing.screenBottom,
  },
  screenWide: {
    maxWidth: spacing.wideMax,
    flexDirection: 'row',
    gap: spacing.wideGap,
  },
  // Right column on a wide screen: greeting at the top, buttons at the bottom
  side: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.subtitle,
    lineHeight: lineHeight.subtitle,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
    textAlign: 'center',
  },
  stage: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  buttons: {
    gap: spacing.buttonGap,
  },
  icon: {
    width: size.pillIconSmall,
    height: size.pillIconSmall,
  },
  bookIcon: {
    // Figma book is 230 × 282; keep its proportion at button size
    width: 26,
    height: 32,
  },
});
