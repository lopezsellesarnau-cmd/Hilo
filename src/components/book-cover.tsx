import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeight } from '@/theme';

// Figma book: 230 × 282, left corners 20, right corners 90, spine 20 in #637160
const FIGMA = { width: 230, height: 282, left: 20, right: 90, spine: 20 };
const spineColor = '#637160';

type Props = {
  width: number;
  title?: string;
  caption?: string;
};

export function BookCover({ width, title, caption }: Props) {
  const k = width / FIGMA.width;
  const height = FIGMA.height * k;
  return (
    <View
      accessible
      accessibilityLabel={title}
      style={[
        styles.cover,
        {
          width,
          height,
          borderTopLeftRadius: FIGMA.left * k,
          borderBottomLeftRadius: FIGMA.left * k,
          borderTopRightRadius: FIGMA.right * k,
          borderBottomRightRadius: FIGMA.right * k,
          paddingLeft: FIGMA.spine * k + 14,
        },
      ]}>
      <View
        style={[
          styles.spine,
          { width: FIGMA.spine * k, borderTopLeftRadius: FIGMA.left * k, borderBottomLeftRadius: FIGMA.left * k },
        ]}
      />
      {title ? <Text style={[styles.title, { fontSize: Math.round(22 * k * 1.5) }]}>{title}</Text> : null}
      {caption ? <Text style={[styles.caption, { fontSize: Math.round(13 * k * 1.5) }]}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.sage,
    justifyContent: 'space-between',
    paddingTop: 22,
    paddingBottom: 16,
    paddingRight: 16,
    overflow: 'hidden',
  },
  spine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: spineColor,
  },
  title: {
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'left',
  },
  caption: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.ink,
    textAlign: 'left',
  },
});
