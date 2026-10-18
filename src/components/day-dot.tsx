import { StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { colors } from '@/theme';

/** A dose of the day like on the senior's Pills screen: done (black with a tick), now (thick ring), later (dashed). */
export function DayDot({ state, size = 44 }: { state: 'done' | 'now' | 'later'; size?: number }) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2 },
        state === 'done' && styles.done,
        state === 'now' && { borderStyle: 'solid', borderColor: colors.accent, borderWidth: Math.round(size / 10) },
      ]}>
      {state === 'done' ? <CheckIcon size={size * 0.55} /> : null}
      {state === 'now' ? <View style={{ width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: colors.accent }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#a0a0a0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    borderStyle: 'solid',
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
