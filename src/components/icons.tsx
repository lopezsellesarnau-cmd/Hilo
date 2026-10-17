import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/** Line icons of the 18 oct prototype. Decorative: the button around them carries the label. */

type Props = { size?: number; color?: string };

export function MicIcon({ size = 24, color = colors.onAccent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

export function RepeatIcon({ size = 26, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3.96 12.73C4.08 16.08 6.68 19.1 10.41 19.85C14.14 20.61 17.89 18.63 19.37 15.12C20.85 11.61 19.65 7.54 16.5 5.4C13.35 3.25 9.02 3.91 7.02 6.05" />
      <Path d="M4 4v5h5" />
    </Svg>
  );
}

export function CheckIcon({ size = 28, color = colors.onAccent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

/** The big pill of "Ahora te toca": black half and white half, tilted */
export function PillIllustration({ size = 150 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <G transform="rotate(-35 60 60)">
        <Rect x={14} y={38} width={92} height={44} rx={22} fill={colors.ink} />
        <Path d="M60 38h24a22 22 0 0 1 0 44H60z" fill={colors.background} stroke={colors.ink} strokeWidth={5} />
      </G>
    </Svg>
  );
}

/** A round black button with a chevron, at the end of a row */
export function ChevronCircle({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Circle cx={26} cy={26} r={26} fill={colors.accent} />
      <Path d="M22 17l9 9-9 9" fill="none" stroke={colors.onAccent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
