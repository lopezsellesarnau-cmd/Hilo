import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/press-scale';

import { colors, family, fontSize, fontWeight, size } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
  /** "fill": black background, white text (main action). "outline": black border on white. */
  variant?: 'fill' | 'outline';
  /** Small text on the right, e.g. "0 de 3" */
  detail?: string;
  /** Icon on the left (fill) or on the right (outline), as in the Figma */
  icon?: ReactNode;
  accessibilityHint?: string;
  /** "senior": large (Figma senior screens). "family": smaller, for the family side. */
  scale?: 'senior' | 'family';
};

export function BigButton({ label, onPress, variant = 'fill', detail, icon, accessibilityHint, scale = 'senior' }: Props) {
  const outline = variant === 'outline';
  const compact = scale === 'family';
  // An outline button with nothing on the right centres its label, like a fill button
  const spread = outline && (detail || icon);
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityHint={accessibilityHint}
      style={[styles.base, outline ? styles.outline : styles.fill, compact && styles.familyBase, compact && outline && styles.familyOutline]}>
      {spread ? (
        <View style={styles.rowSpread}>
          <Text style={[styles.label, !outline && styles.labelOnFill, compact && styles.familyLabel]} numberOfLines={2}>
            {label}
          </Text>
          <View style={styles.right}>
            {detail ? <Text style={[styles.detail, !outline && styles.labelOnFill]}>{detail}</Text> : null}
            {icon}
          </View>
        </View>
      ) : (
        <View style={styles.rowCenter}>
          {icon}
          <Text style={[styles.label, !outline && styles.labelOnFill, compact && styles.familyLabel]} numberOfLines={2}>
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
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
  },
  labelOnFill: {
    color: colors.onAccent,
  },
  outline: {
    backgroundColor: colors.background,
    borderWidth: size.buttonBorder,
    borderColor: colors.accent,
    paddingLeft: 24,
    paddingRight: 20,
  },
  familyBase: {
    minHeight: family.size.buttonHeight,
    borderRadius: family.size.buttonRadius,
  },
  familyOutline: {
    borderWidth: family.size.buttonBorder,
  },
  familyLabel: {
    fontSize: family.fontSize.button,
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
    fontWeight: fontWeight.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  detail: {
    fontSize: fontSize.count,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
});
