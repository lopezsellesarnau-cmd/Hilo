import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { staffColors } from './theme';

type Props = { size?: number; color?: string };

/** The Hilo bot as a flat mark: sidebar logo, People icon and the avatar of someone with no photo. */
export function BotMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  const fill = light ? '#fff' : staffColors.ink;
  const face = light ? staffColors.ink : '#fff';
  return (
    <Svg width={size} height={size} viewBox="0 0 351 351">
      <Circle cx={175.5} cy={175.5} r={175.5} fill={fill} />
      <Path d="M140 168 Q 215 194 292 150" stroke={face} strokeWidth={14} strokeLinecap="round" fill="none" />
      <Circle cx={135} cy={164.5} r={38} fill={face} />
      <Ellipse cx={296} cy={146} rx={29} ry={37} fill={face} />
    </Svg>
  );
}

const line = (color: string) => ({ fill: 'none', stroke: color, strokeWidth: 1.6 });

export function TodayIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3.5 10.5 12 3.5l8.5 7V20h-5.5v-6h-6v6H3.5z" strokeLinejoin="round" {...line(color)} />
    </Svg>
  );
}

export function AddPersonIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={10} cy={8} r={3.8} {...line(color)} />
      <Path d="M3.5 20c.8-3.6 3.5-5.6 6.5-5.6 1.2 0 2.3.3 3.3.8M18 14v6M15 17h6" strokeLinecap="round" {...line(color)} />
    </Svg>
  );
}

export function ReportsIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20h16M7.5 16v-5M12 16V6.5M16.5 16v-7.5" strokeLinecap="round" {...line(color)} />
    </Svg>
  );
}

export function SignOutIcon({ size = 18, color = staffColors.muted }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" {...line(color)} />
    </Svg>
  );
}

