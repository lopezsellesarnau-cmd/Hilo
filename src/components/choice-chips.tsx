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

type MultiProps<T extends string> = Omit<Props<T>, 'value' | 'onChange'> & {
  value: readonly T[];
  onChange: (value: T[]) => void;
};

function Chips<T extends string>({
  options,
  label,
  isOn,
  onPress,
  multiple,
}: {
  options: readonly Option<T>[];
  label: string;
  isOn: (v: T) => boolean;
  onPress: (v: T) => void;
  multiple: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label}>
      {options.map((o) => {
        const on = isOn(o.value);
        return (
          <PressScale
            key={o.value}
            onPress={() => onPress(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={multiple ? { checked: on } : { selected: on }}
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

/** Pick one option from a few, as rounded chips that wrap. */
export function ChoiceChips<T extends string>({ options, value, onChange, label }: Props<T>) {
  return <Chips options={options} label={label} isOn={(v) => v === value} onPress={onChange} multiple={false} />;
}

/** Pick several options, e.g. the times of a pill. Keeps the order of `options`. */
export function MultiChoiceChips<T extends string>({ options, value, onChange, label }: MultiProps<T>) {
  const toggle = (v: T) =>
    onChange(options.map((o) => o.value).filter((x) => (x === v ? !value.includes(x) : value.includes(x))));
  return <Chips options={options} label={label} isOn={(v) => value.includes(v)} onPress={toggle} multiple />;
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
    borderColor: colors.accent,
    backgroundColor: colors.background,
  },
  chipOn: {
    backgroundColor: colors.accent,
  },
  text: {
    fontSize: family.fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
  },
  textOn: {
    color: colors.onAccent,
  },
});
