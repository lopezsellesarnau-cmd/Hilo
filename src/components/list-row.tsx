import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChevronCircle } from '@/components/icons';
import { PressScale } from '@/components/press-scale';
import { colors, fontWeight } from '@/theme';

type Props = {
  /** Small grey line above the title, e.g. "NUEVA HISTORIA" */
  kicker?: string;
  title: string;
  detail?: string;
  /** A dot, the bot or an icon on the left */
  left?: ReactNode;
  /** Black instead of grey: the one thing on the screen that matters most */
  dark?: boolean;
  /** With onPress the row gets the round black arrow, like the chapters in the senior's book */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The grey pill row of the 18 oct design, shared by the family screens. */
export function ListRow({ kicker, title, detail, left, dark = false, onPress, accessibilityLabel }: Props) {
  const body = (
    <>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.text}>
        {kicker ? <Text style={[styles.kicker, dark && styles.kickerDark]}>{kicker}</Text> : null}
        <Text style={[styles.title, dark && styles.onDark]}>{title}</Text>
        {detail ? <Text style={[styles.detail, dark && styles.detailDark]}>{detail}</Text> : null}
      </View>
      {onPress ? <ChevronCircle inverted={dark} /> : null}
    </>
  );
  const style = [styles.row, dark && styles.rowDark, onPress ? styles.pressable : null];
  const label = accessibilityLabel ?? [kicker, title, detail].filter(Boolean).join('. ');
  return onPress ? (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={style}>
      {body}
    </PressScale>
  ) : (
    <View style={style} accessible accessibilityLabel={label}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
  },
  // Room for the round arrow, like the senior's chapters
  pressable: {
    paddingRight: 12,
  },
  rowDark: {
    backgroundColor: colors.accent,
  },
  left: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  kickerDark: {
    color: 'rgba(255,255,255,0.6)',
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: fontWeight.bold,
    color: colors.ink,
  },
  onDark: {
    color: colors.onAccent,
  },
  detail: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
  },
  detailDark: {
    color: 'rgba(255,255,255,0.75)',
  },
});
