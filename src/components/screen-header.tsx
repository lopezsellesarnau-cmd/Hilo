import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { colors, fontSize, fontWeight, lineHeight } from '@/theme';

type Props = {
  title: string;
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
          hitSlop={12}
          style={styles.back}>
          <Text style={styles.backText}>‹ {backLabel}</Text>
        </Pressable>
      ) : null}
      <View accessibilityRole="header" style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 14,
  },
  backText: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  titles: {
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
});
