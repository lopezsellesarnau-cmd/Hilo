import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEIGHT = 115; // Figma "APP gradient"

/**
 * Tracks a ScrollView and says whether there is more content below.
 * Spread `scrollProps` on the ScrollView and pass `visible` to <ScrollFade />.
 */
export function useScrollFade() {
  const box = useRef({ layout: 0, content: 0, offset: 0 });
  const [visible, setVisible] = useState(false);

  const update = useCallback(() => {
    const { layout, content, offset } = box.current;
    setVisible(content - layout - offset > 4);
  }, []);

  const scrollProps = {
    onLayout: (e: LayoutChangeEvent) => {
      box.current.layout = e.nativeEvent.layout.height;
      update();
    },
    onContentSizeChange: (_w: number, h: number) => {
      box.current.content = h;
      update();
    },
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      box.current.offset = e.nativeEvent.contentOffset.y;
      update();
    },
    scrollEventThrottle: 32,
  };

  return { visible, scrollProps };
}

/**
 * Bottom fade: content blurs and fades into the background (white, or the book's paper) while there is more to scroll.
 * Hidden at the end so the last item is fully readable.
 */
export function ScrollFade({ visible, color = '#ffffff' }: { visible: boolean; color?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { height: HEIGHT + insets.bottom, opacity: visible ? 1 : 0 },
        { transitionProperty: 'opacity', transitionDuration: 250 },
      ]}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={
          <LinearGradient colors={['transparent', '#000']} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
        }>
        <BlurView intensity={12} tint="light" blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
      </MaskedView>
      <LinearGradient
        colors={[`${color}00`, `${color}bf`, color]}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
