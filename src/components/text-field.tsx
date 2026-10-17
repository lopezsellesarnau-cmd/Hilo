import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, family, fontWeight } from '@/theme';

type Props = TextInputProps & {
  label: string;
  /** Big centred digits, for one-time codes */
  code?: boolean;
};

export function TextField({ label, code = false, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#b0b0ae"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, code && styles.code, focused && styles.focused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  input: {
    fontSize: 22,
    fontWeight: '500',
    // Always set: with view recycling, iOS keeps the code field's spacing on the next input
    letterSpacing: 0,
    textAlign: 'left',
    color: colors.ink,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e4e4e4',
    backgroundColor: colors.background,
  },
  code: {
    fontSize: 30,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    letterSpacing: 12,
    fontVariant: ['tabular-nums'],
  },
  focused: {
    borderColor: colors.accent,
  },
});
