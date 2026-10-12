import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/components/press-scale';
import { colors, family, fontWeight } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Read by VoiceOver for the whole group, e.g. "Hora de la charla" */
  label: string;
};

/** Pick one option from a few, as rounded chips that wrap. */
export function ChoiceChips<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            animateColor
            style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.sage,
    backgroundColor: colors.background,
  },
  chipOn: {
    backgroundColor: colors.sage,
  },
  text: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  textOn: {
    color: colors.ink,
  },
});
