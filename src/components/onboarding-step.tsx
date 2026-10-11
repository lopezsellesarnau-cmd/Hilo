import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, family, fontWeight, spacing } from '@/theme';

const TOTAL_STEPS = 6;

type Props = {
  /** 1 to 6, shown as progress dots */
  step: number;
  question: string;
  hint?: ReactNode;
  children?: ReactNode;
  /** Buttons pinned to the bottom (above the keyboard) */
  footer?: ReactNode;
};

/** One question per screen, as in the family prototype. */
export function OnboardingStep({ step, question, hint, children, footer }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            hitSlop={12}
            style={styles.back}>
            <Text style={styles.backText}>‹ Atrás</Text>
          </Pressable>

          <View style={styles.dots} accessible accessibilityLabel={`Paso ${step} de ${TOTAL_STEPS}`}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i + 1 === step && styles.dotOn]} />
            ))}
          </View>

          <Text style={styles.question} accessibilityRole="header">
            {question}
          </Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <View style={styles.body}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: 24,
    paddingBottom: 24,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 10,
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
    marginTop: 'auto',
    paddingTop: 28,
    gap: 12,
  },
});
