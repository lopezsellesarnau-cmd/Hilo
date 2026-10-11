import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/press-scale';

import { colors, fontSize, fontWeight, size } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
  /** "fill": sage background (main action). "outline": sage border on white. */
  variant?: 'fill' | 'outline';
  /** Small text on the right, e.g. "0 de 3" */
  detail?: string;
  /** Icon on the left (fill) or on the right (outline), as in the Figma */
  icon?: ReactNode;
  accessibilityHint?: string;
};

export function BigButton({ label, onPress, variant = 'fill', detail, icon, accessibilityHint }: Props) {
  const outline = variant === 'outline';
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={accessibilityHint}
      style={[styles.base, outline ? styles.outline : styles.fill]}>
      {outline ? (
        <View style={styles.rowSpread}>
          <Text style={styles.label} numberOfLines={2}>
            {label}
          </Text>
          <View style={styles.right}>
            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
            {icon}
          </View>
        </View>
      ) : (
        <View style={styles.rowCenter}>
          {icon}
          <Text style={styles.label} numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    // minHeight, not height: the text grows when the senior uses large system text
    minHeight: size.buttonHeight,
    borderRadius: size.buttonRadius,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  fill: {
    backgroundColor: colors.sage,
    paddingHorizontal: 24,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: size.buttonBorder,
    borderColor: colors.sage,
    paddingLeft: 24,
    paddingRight: 20,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  rowSpread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    flexShrink: 1,
    fontSize: fontSize.button,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'center',
  },
  detail: {
    fontSize: fontSize.count,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
});
