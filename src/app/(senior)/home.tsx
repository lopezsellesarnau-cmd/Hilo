import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bot } from '@/components/bot';
import { MicIcon } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { WideSplit } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide, wideBotSize } from '@/lib/layout';
import { askForReminders, scheduleReminders } from '@/lib/reminders';
import { loadBook } from '@/lib/book';
import { loadSeniorDay } from '@/lib/senior-day';
import { colors, fontSize, fontWeight, lineHeight, spacing } from '@/theme';

/** When the app opens: greeting, bot and buttons appear one after another, gently.
 * Skipped automatically when "Reduce Motion" is on. */
const enter = (order: number) => FadeInDown.duration(500).delay(order === 0 ? 0 : 250 + order * 90);

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  // iPad on its side: bot on the left, greeting and buttons on the right (Figma IPAD MINI / DUO 2)
  const wide = useWide();
  // Never a fixed 265: on short screens a fixed bot overlaps the greeting (prototype bug)
  const botSize = wide ? wideBotSize(width, height) : Math.min(250, width * 0.64, height * 0.3);

  // Name and today's pills, refreshed every time the senior comes back to the home
  const [name, setName] = useState<string | null>(null);
  const [pills, setPills] = useState<{ taken: number; total: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      // Ready before she taps Mi libro
      loadBook();
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
      <Text style={styles.title}>{t.home.hello(name)}</Text>
      <Text style={styles.subtitle}>{t.home.howAreYou}</Text>
    </Animated.View>
  );

  const talk = () => router.push('/talk');

  // The bot itself opens the talk too: it's the biggest thing on the screen
  const stage = (
    <Animated.View entering={FadeIn.duration(700).delay(150)} style={styles.stage}>
      <PressScale onPress={talk} accessibilityRole="button" accessibilityLabel={t.home.tapToTalk} accessibilityHint={t.home.talkHint}>
        <Bot size={botSize} mood="idle" />
      </PressScale>
    </Animated.View>
  );

  const buttons = (
    <View style={styles.buttons}>
      <Animated.View entering={enter(1)} style={styles.talkWrap}>
        <PressScale onPress={talk} accessibilityRole="button" accessibilityHint={t.home.talkHint} style={styles.talk}>
          <MicIcon />
          <Text style={styles.talkText}>{t.home.tapToTalk}</Text>
        </PressScale>
      </Animated.View>
      {/* Pills and book in one black bar: the pills half is white, the one she needs most */}
      <Animated.View entering={enter(2)} style={styles.bar}>
        <PressScale
          onPress={() => router.push('/pills')}
          accessibilityRole="button"
          accessibilityLabel={pills?.total ? `${t.home.pills}, ${t.home.pillsCount(pills.taken, pills.total)}` : t.home.pills}
          containerStyle={styles.barSlot}
          style={[styles.barItem, styles.barItemOn]}>
          <Text style={styles.barText} numberOfLines={1}>
            {t.home.pills}
          </Text>
          {pills?.total ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{`${pills.taken}/${pills.total}`}</Text>
            </View>
          ) : null}
        </PressScale>
        <PressScale onPress={() => router.push('/book')} accessibilityRole="button" containerStyle={styles.barSlot} style={styles.barItem}>
          <Text style={[styles.barText, styles.barTextOff]} numberOfLines={1}>
            {t.home.book}
          </Text>
        </PressScale>
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.screen, wide && styles.screenWide]} bounces={false}>
        {wide ? (
          <WideSplit side={stage}>
            <View style={styles.side}>
              {header}
              {buttons}
            </View>
          </WideSplit>
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
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: fontSize.subtitle,
    lineHeight: lineHeight.subtitle,
    fontWeight: fontWeight.regular,
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
    // Air between "Toca para charlar" and the bar, so one isn't tapped for the other
    gap: 44,
  },
  talkWrap: {
    alignItems: 'center',
  },
  talk: {
    minWidth: 287,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  talkText: {
    flexShrink: 1,
    fontSize: 25,
    fontWeight: fontWeight.bold,
    color: colors.onAccent,
    textAlign: 'center',
  },
  bar: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  // Both halves the same width whatever the text
  barSlot: {
    flex: 1,
    flexBasis: 0,
  },
  barItem: {
    flexGrow: 1,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  barItemOn: {
    backgroundColor: colors.background,
  },
  barText: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  barTextOff: {
    color: colors.onAccent,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.onAccent,
  },
});
