import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bot, type BotMood } from '@/components/bot';
import { WideSplit } from '@/components/wide-split';
import { t } from '@/i18n';
import { useWide, wideBotSize } from '@/lib/layout';
import { colors, family, fontWeight, spacing } from '@/theme';

const TOTAL_STEPS = 6;

type Props = {
  /** 1 to 6, shown as progress dots. Left out when the screen is opened from Ajustes to edit */
  step?: number;
  question: string;
  hint?: ReactNode;
  children?: ReactNode;
  /** Buttons pinned to the bottom (above the keyboard) */
  footer?: ReactNode;
  /** The bot above the question: 'thinking' while something is saving */
  mood?: BotMood;
};

/** One question per screen, as in the family prototype. */
export function OnboardingStep({ step, question, hint, children, footer, mood = 'idle' }: Props) {
  const { width, height } = useWindowDimensions();
  // iPad on its side: a big bot on the left, the question and its buttons on the right
  const wide = useWide();

  const content = (
    <>
      {/* Hidden when the user resumed here after signing in: there is nothing behind */}
      {router.canGoBack() ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t.common.back}
          hitSlop={12}
          style={styles.back}>
          <Text style={styles.backText}>‹ {t.common.back}</Text>
        </Pressable>
      ) : (
        <View style={styles.backSpace} />
      )}

      {step ? (
        <View style={styles.dots} accessible accessibilityLabel={t.onboarding.stepOf(step, TOTAL_STEPS)}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, i + 1 === step && styles.dotOn]} />
          ))}
        </View>
      ) : null}

      {wide ? null : (
        <View style={styles.bot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Bot size={72} mood={mood} />
        </View>
      )}

      <Text style={styles.question} accessibilityRole="header">
        {question}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <View style={styles.body}>{children}</View>
    </>
  );

  // Outside the scroll: on long steps it would be cut at the bottom edge
  const buttons = footer ? <View style={[styles.footer, wide && styles.footerWide]}>{footer}</View> : null;

  if (wide) {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.wide}>
            <WideSplit
              side={
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Bot size={wideBotSize(width, height)} mood={mood} />
                </View>
              }>
              <ScrollView contentContainerStyle={styles.sideScroll} keyboardShouldPersistTaps="handled">
                {content}
              </ScrollView>
              {buttons}
            </WideSplit>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
        {buttons}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  screen: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    paddingBottom: 24,
  },
  wide: {
    flex: 1,
    width: '100%',
    maxWidth: spacing.wideMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenX,
  },
  sideScroll: {
    flexGrow: 1,
    paddingTop: 24,
    paddingBottom: 24,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 10,
  },
  backSpace: {
    height: 37,
  },
  backText: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 26,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e6e8e4',
  },
  dotOn: {
    width: 22,
    backgroundColor: colors.sage,
  },
  bot: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  question: {
    fontSize: family.fontSize.question,
    lineHeight: 36,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    marginTop: 6,
    marginBottom: 8,
  },
  hint: {
    fontSize: family.fontSize.body,
    lineHeight: 26,
    fontWeight: '500',
    color: colors.muted,
    marginBottom: 22,
  },
  body: {
    gap: 12,
  },
  footer: {
    width: '100%',
    maxWidth: spacing.contentMax,
    alignSelf: 'center',
    flexShrink: 0,
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  // Already inside the right half, which has its own side padding
  footerWide: {
    maxWidth: undefined,
    paddingHorizontal: 0,
  },
});
