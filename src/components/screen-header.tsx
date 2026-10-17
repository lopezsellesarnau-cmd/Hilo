import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fontSize, fontWeight, lineHeight } from '@/theme';

type Props = {
  /** Without a title only the back button shows (the talk) */
  title?: string;
  subtitle?: string;
  /** Text of the back link, e.g. "Inicio". Hidden when not given. */
  backLabel?: string;
};

export function ScreenHeader({ title, subtitle, backLabel }: Props) {
  return (
    <View>
      {backLabel ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t.common.backTo(backLabel)}
          hitSlop={8}
          style={styles.back}>
          <Text style={styles.backText}>
            <Text style={styles.backArrow}>‹ </Text>
            {backLabel}
          </Text>
        </Pressable>
      ) : null}
      {title ? (
        <View accessibilityRole="header" style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Pill with a black outline, like every button of the 18 oct prototype
  back: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 20,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.ink,
    marginBottom: 22,
  },
  backText: {
    fontSize: 19,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  backArrow: {
    fontSize: 24,
  },
  titles: {
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.subtitle,
    lineHeight: lineHeight.subtitle,
    fontWeight: fontWeight.regular,
    color: colors.muted,
    textAlign: 'center',
  },
});
