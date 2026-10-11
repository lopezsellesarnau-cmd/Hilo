import type { ReactNode } from 'react';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Also fade the background colour when the style changes (e.g. sage → black) */
  animateColor?: boolean;
};

/**
 * Pressable that shrinks a little while pressed and springs back.
 * One feel for every button in the app. Respects "Reduce Motion".
 */
export function PressScale({ style, children, animateColor = false, ...props }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <Pressable {...props}>
      {({ pressed }) => (
        <Animated.View
          style={[
            style,
            !reduceMotion && pressed && { transform: [{ scale: 0.97 }] },
            animateColor
              ? {
                  transitionProperty: ['transform', 'backgroundColor'],
                  transitionDuration: ['150ms', '300ms'],
                  transitionTimingFunction: 'ease-out',
                }
              : { transitionProperty: 'transform', transitionDuration: '150ms', transitionTimingFunction: 'ease-out' },
          ]}>
          {children}
        </Animated.View>
      )}
    </Pressable>
  );
}
