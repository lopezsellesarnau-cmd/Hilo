import Svg, { Circle, Path } from 'react-native-svg';

import { BOT_SHAPES, LiveBot, type BotShape } from '@/components/live-bot';

import { staffColors } from './theme';

type Props = { size?: number; color?: string };

/** Hilo itself: the hexagon of the app icon. Sidebar logo, People icon, voice card and a new person with no photo yet.
 * On the web its eyes follow the mouse. */
export function BotMark({ size = 28, light = false }: { size?: number; light?: boolean }) {
  return <LiveBot size={size} shape="hexagon" cursor {...tones(light)} />;
}

/** Each person's own bot, in the shape `shapesFor` gave them. */
export function PersonBot({ shape, size = 31, light = false }: { shape: BotShape | undefined; size?: number; light?: boolean }) {
  return <LiveBot size={size} shape={shape ?? 'circle'} cursor {...tones(light)} />;
}

/** A shape per person, by the order they joined the organisation: the first nine are all different
 * (hexagon included), then it starts again. Same list on every page, so the same shape everywhere. */
export function shapesFor(people: { id: string; created_at: string }[]): Record<string, BotShape> {
  const order = [...people].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  return Object.fromEntries(order.map((p, i) => [p.id, BOT_SHAPES[i % BOT_SHAPES.length]]));
}

const tones = (light: boolean) =>
  light ? { color: '#fff', eyeColor: staffColors.ink } : { color: staffColors.ink, eyeColor: '#fff' };

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
      <Path
        d="M3.5 20c.8-3.6 3.5-5.6 6.5-5.6 1.2 0 2.3.3 3.3.8M18 14v6M15 17h6"
        strokeLinecap="round"
        {...line(color)}
      />
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
      <Path
        d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...line(color)}
      />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"
        strokeLinejoin="round"
        {...line(color)}
      />
    </Svg>
  );
}

export function PillIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8.5 20.5a5 5 0 0 1-3.5-8.5l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-3.5 1.5zM8.5 8.5l7 7"
        strokeLinejoin="round"
        {...line(color)}
      />
    </Svg>
  );
}

export function FamilyIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={8.5} r={3.2} {...line(color)} />
      <Circle cx={17} cy={9.5} r={2.5} {...line(color)} />
      <Path
        d="M3.5 19.5c.7-3.2 2.9-4.8 5.5-4.8s4.8 1.6 5.5 4.8M15.6 14.7c2.4-.2 4.3 1.2 5 4.3"
        strokeLinecap="round"
        {...line(color)}
      />
    </Svg>
  );
}

export function NoteIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 3.5h9l3.5 3.5v13.5H6zM9 11h6M9 15h6" strokeLinejoin="round" strokeLinecap="round" {...line(color)} />
    </Svg>
  );
}

/** A staff badge: the Team page */
export function TeamIcon({ size = 20, color = staffColors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5z"
        {...line(color)}
      />
      <Circle cx={12} cy={10.5} r={2.6} {...line(color)} />
      <Path d="M7.5 17c.7-2 2.4-3 4.5-3s3.8 1 4.5 3" strokeLinecap="round" {...line(color)} />
    </Svg>
  );
}
