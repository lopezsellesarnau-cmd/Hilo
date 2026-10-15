import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

type Props = {
  /** Left half: the bot, or her book */
  side: ReactNode;
  /** Right half: the screen's text and buttons */
  children: ReactNode;
};

/** iPad on its side (see useWide): two equal halves, so the content on the right is never squeezed by the picture. */
export function WideSplit({ side, children }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.half, styles.side]}>{side}</View>
      <View style={styles.half}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.wideGap,
  },
  // flexBasis 0: both halves the same width whatever is inside
  half: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  side: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
