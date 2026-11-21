import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import Animated, {
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type CSSAnimationKeyframes,
} from 'react-native-reanimated';

import { colors, family, fontWeight } from '@/theme';

/**
 * A one-time code as one box per digit (the code row of the StackD OTP input, Kit 15).
 * Digits pop into their box, several at once one after another (paste, the code from Messages or Mail).
 * Checking: the boxes ripple. Right: they turn black one by one. Wrong: the row shakes, and the next digit
 * typed starts the code over. One real input underneath, so autofill, paste and VoiceOver all work.
 * The screen keeps the code and checks it; this only shows it.
 */

export type CodeStatus = 'idle' | 'checking' | 'error' | 'success';

type Props = {
  label: string;
  value: string;
  onChangeText: (code: string) => void;
  length: number;
  status?: CodeStatus;
  autoFocus?: boolean;
};

const wave: CSSAnimationKeyframes = {
  '0%': { transform: [{ translateY: 0 }] },
  '25%': { transform: [{ translateY: -6 }] },
  '55%': { transform: [{ translateY: 0 }] },
  '100%': { transform: [{ translateY: 0 }] },
};
const caret: CSSAnimationKeyframes = {
  '0%': { opacity: 1 },
  '45%': { opacity: 1 },
  '50%': { opacity: 0 },
  '95%': { opacity: 0 },
  '100%': { opacity: 1 },
};

const GAP = 8;

export function CodeBoxes({ label, value, onChangeText, length, status = 'idle', autoFocus }: Props) {
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(0);
  // Digits that arrive together drop in one after another from here
  const [from, setFrom] = useState(0);
  const shake = useSharedValue(0);

  const busy = status === 'checking';
  const done = status === 'success';
  const wrong = status === 'error';
  const split = length >= 6 && length % 2 === 0;
  const active = Math.min(value.length, length - 1);

  // As big as fits: 6 boxes on a phone are about 50 wide, 8 a little smaller
  const dash = split ? 18 : 0;
  const box = width ? Math.min(58, (width - GAP * (length - 1) - dash) / length) : 48;

  // Wrong: the row shakes once
  useEffect(() => {
    if (!wrong || reduceMotion) return;
    shake.value = withSequence(...[-8, 7, -5, 3, 0].map((x) => withTiming(x, { duration: 70 })));
  }, [wrong, reduceMotion, shake]);
  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const change = (raw: string) => {
    if (busy || done) return;
    let digits = raw.replace(/\D/g, '');
    // After a wrong code, the next digit starts over instead of being added
    if (wrong) digits = digits.slice(value.length);
    digits = digits.slice(0, length);
    setFrom(wrong ? 0 : value.length);
    onChangeText(digits);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.row, shaking]}>
          {Array.from({ length }, (_, i) => {
            const ch = value[i];
            const on = focused && !busy && !done && !wrong && i === active;
            return (
              <View key={i} style={styles.slot}>
                {split && i === length / 2 ? <View style={styles.dash} /> : null}
                <Animated.View
                  style={[
                    styles.box,
                    { width: box, height: box * 1.25, borderRadius: box * 0.3 },
                    on && styles.boxOn,
                    wrong && ch ? styles.boxWrong : null,
                    done && styles.boxDone,
                    done && !reduceMotion && { transitionDelay: `${i * 60}ms` },
                    busy && !reduceMotion
                      ? {
                          animationName: wave,
                          animationDuration: '900ms',
                          animationDelay: `${i * 70}ms`,
                          animationIterationCount: 'infinite',
                          animationTimingFunction: 'ease-in-out',
                        }
                      : null,
                  ]}>
                  {ch ? (
                    <Animated.Text
                      // A new key per digit, so each one pops in when it arrives
                      key={`${i}${ch}`}
                      entering={reduceMotion ? undefined : ZoomIn.duration(240).delay(Math.max(0, i - from) * 55)}
                      style={[styles.digit, { fontSize: box * 0.52 }, done && styles.digitDone]}>
                      {ch}
                    </Animated.Text>
                  ) : on ? (
                    <Animated.View
                      style={[
                        styles.caret,
                        { height: box * 0.5 },
                        !reduceMotion && {
                          animationName: caret,
                          animationDuration: '1s',
                          animationIterationCount: 'infinite',
                          animationTimingFunction: 'steps(1)',
                        },
                      ]}
                    />
                  ) : null}
                </Animated.View>
              </View>
            );
          })}
        </Animated.View>

        {/* The one real input, invisible, over the boxes */}
        <TextInput
          value={value}
          onChangeText={change}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!busy && !done}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          // Room for a pasted code with spaces ("1234 5678")
          maxLength={length * 2}
          caretHidden
          contextMenuHidden={false}
          accessibilityLabel={label}
          accessibilityHint={`${length} digits`}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  // Same as TextField's label
  label: {
    fontSize: family.fontSize.note,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP,
  },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dash: {
    width: 10,
    height: 2,
    borderRadius: 1,
    marginRight: GAP,
    backgroundColor: colors.ink,
    opacity: 0.25,
  },
  // Grey and round like TextField; black outline on the box you're typing in
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    transitionProperty: ['backgroundColor', 'borderColor'],
    transitionDuration: '300ms',
  },
  boxOn: {
    borderColor: colors.accent,
  },
  boxWrong: {
    borderColor: colors.error,
  },
  boxDone: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  digit: {
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  digitDone: {
    color: colors.background,
  },
  caret: {
    width: 2,
    borderRadius: 1,
    backgroundColor: colors.ink,
  },
  input: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    backgroundColor: 'transparent',
    // Almost invisible but still tappable and focusable everywhere
    opacity: 0.011,
    fontSize: 16,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null),
  },
});
