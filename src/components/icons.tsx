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

export function PhoneIcon({ size = 24, color = colors.onAccent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
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

/** A round black button with a chevron, at the end of a row. Inverted: white on a black row. */
export function ChevronCircle({ size = 52, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Circle cx={26} cy={26} r={26} fill={inverted ? colors.onAccent : colors.accent} />
      <Path
        d="M22 17l9 9-9 9"
        fill="none"
        stroke={inverted ? colors.accent : colors.onAccent}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = colors.onAccent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 24, color = colors.onAccent }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={6} y={5} width={4.5} height={14} rx={1.5} fill={color} />
      <Rect x={13.5} y={5} width={4.5} height={14} rx={1.5} fill={color} />
    </Svg>
  );
}

/** The crown over first place in Familia */
export function CrownIcon({ size = 28, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={(size * 20) / 28} viewBox="0 0 28 20" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M3 17h22L23 5l-5 5-4-8-4 8-5-5z" />
    </Svg>
  );
}

/** Inline in the sentence at the top of Hoy: chat, pills, story */
export function ChatIcon({ size = 22, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </Svg>
  );
}

export function PillIcon({ size = 22, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={8.5} width={18} height={7} rx={3.5} transform="rotate(-35 12 12)" />
      <Path d="m9.5 8.5 5 7" />
    </Svg>
  );
}

export function StoryIcon({ size = 22, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <Path d="M4 21V5" />
    </Svg>
  );
}


/** Settings: a filled gear, drawn for Hilo (Apple-style, no outline) */
export function GearIcon({ size = 22, color = colors.ink }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M10.3 2.6c.2-.9 1-1.6 1.9-1.6h-.4c.9 0 1.7.7 1.9 1.6l.3 1.4c.6.2 1.2.5 1.7.8l1.2-.8c.8-.5 1.8-.4 2.5.3l.3.3c.7.7.8 1.7.3 2.5l-.8 1.2c.3.5.6 1.1.8 1.7l1.4.3c.9.2 1.6 1 1.6 1.9v.4c0 .9-.7 1.7-1.6 1.9l-1.4.3c-.2.6-.5 1.2-.8 1.7l.8 1.2c.5.8.4 1.8-.3 2.5l-.3.3c-.7.7-1.7.8-2.5.3l-1.2-.8c-.5.3-1.1.6-1.7.8l-.3 1.4c-.2.9-1 1.6-1.9 1.6h-.4c-.9 0-1.7-.7-1.9-1.6l-.3-1.4c-.6-.2-1.2-.5-1.7-.8l-1.2.8c-.8.5-1.8.4-2.5-.3l-.3-.3c-.7-.7-.8-1.7-.3-2.5l.8-1.2c-.3-.5-.6-1.1-.8-1.7l-1.4-.3C1.7 13.7 1 12.9 1 12v-.2c0-.9.7-1.7 1.6-1.9L4 9.6c.2-.6.5-1.2.8-1.7L4 6.7c-.5-.8-.4-1.8.3-2.5l.3-.3c.7-.7 1.7-.8 2.5-.3l1.2.8c.5-.3 1.1-.6 1.7-.8l.3-1.4ZM12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z"
      />
    </Svg>
  );
}

/** A small filled padlock (Salud: encrypted) */
export function LockIcon({ size = 20, color = 'rgba(0,0,0,0.3)' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A2.5 2.5 0 0 1 20 12.5v7A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-7A2.5 2.5 0 0 1 6.5 10H7Zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0V10Z"
      />
    </Svg>
  );
}
