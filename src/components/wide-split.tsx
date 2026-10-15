import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Bot } from '@/components/bot';
import { useWide, wideBotSize } from '@/lib/layout';
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

/**
 * For screens that are one scrolling column: on a wide screen the column moves to the right half
 * and the bot (or `side`) stays still on the left. On a phone it changes nothing.
 */
export function WideFrame({ side, children }: { side?: ReactNode; children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const wide = useWide();
  if (!wide) return children;
  return (
    <View style={styles.frame}>
      <WideSplit
        side={
          side ?? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Bot size={wideBotSize(width, height)} />
            </View>
          )
        }>
        {children}
      </WideSplit>
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
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: spacing.wideMax,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenX,
  },
});
