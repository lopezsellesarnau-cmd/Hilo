import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors, serif } from '@/theme';

// 18 oct prototype: a black hardcover with the pages showing on the right. Drawn on 200 × 250.
const W = 200;
const H = 250;

type Props = {
  width: number;
  title?: string;
  caption?: string;
};

export function BookCover({ width, title, caption }: Props) {
  const k = width / W;
  return (
    <View accessible accessibilityLabel={title} style={{ width, height: H * k }}>
      <Svg width={width} height={H * k} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={22} y={14} width={168} height={226} rx={10} fill="#e6e6e6" />
        <Rect x={18} y={10} width={168} height={226} rx={10} fill={colors.background} stroke={colors.ink} strokeWidth={3} />
        <Path d="M186 22v202M181 18v210" stroke={colors.ink} strokeWidth={2} opacity={0.25} />
        <Rect x={10} y={6} width={168} height={226} rx={10} fill={colors.accent} />
        <Rect x={10} y={6} width={18} height={226} rx={9} fill="#2a2a2a" />
      </Svg>
      {/* Only the title on the black part, right of the spine */}
      <View style={[styles.front, { left: 30 * k, top: 30 * k, width: 146 * k, height: 190 * k }]}>
        {title ? (
          <Text style={[styles.title, { fontSize: 25 * k, lineHeight: 30 * k }]} numberOfLines={3} adjustsFontSizeToFit>
            {title}
          </Text>
        ) : null}
        <View style={[styles.rule, { width: 34 * k, marginTop: 14 * k }]} />
        {caption ? <Text style={[styles.caption, { fontSize: 13 * k }]}>{caption}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  front: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: serif,
    color: colors.onAccent,
    textAlign: 'center',
  },
  rule: {
    height: 1.5,
    backgroundColor: colors.onAccent,
  },
  caption: {
    marginTop: 10,
    color: colors.onAccent,
    textAlign: 'center',
  },
});
