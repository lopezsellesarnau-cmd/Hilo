import { Platform } from 'react-native';

/**
 * Hilo design tokens, taken from the Figma v1 (APP Home, APP speech, APP pills).
 * Font: the system font (SF Pro on iPhone/iPad, Roboto on Android), so no fontFamily is set.
 * SF Pro "Semibold" (590) maps to '600', "Heavy" (860) to '800'.
 */

export const colors = {
  background: '#ffffff',
  ink: '#000000',
  /** Subtitles, times, secondary text. Figma had #a5a5a5 / #898989, darkened for older eyes. */
  muted: '#6b6b6b',
  /** Black on white since the 18 oct redesign (was sage #8fa88a): main buttons, selected states, the bot */
  accent: '#111111',
  /** Text and icons on an accent fill */
  onAccent: '#ffffff',
  /** Ripple ring, progress tracks, empty dots */
  accentSoft: 'rgba(17, 17, 17, 0.14)',
  /** Grey cards and pills (chapters, Hilo's sentence in the talk) */
  surface: '#f4f4f4',
  /** The page of her book, only in the chapter she reads */
  paper: '#faf8f3',
  /** Pill taken / not taken icons, from the Figma */
  taken: '#1dd900',
  missed: '#d70606',
} as const;

export const fontSize = {
  title: 36,
  subtitle: 24,
  button: 23,
  holdButton: 24,
  pillName: 26,
  talk: 20,
  status: 20,
  count: 20,
  label: 18,
  time: 14,
} as const;

/**
 * Book typography, only inside her book (the chapter she reads and the cover): it should feel like reading a book.
 * Iowan Old Style ships with iOS, so nothing to download.
 */
export const serif = Platform.select({ ios: 'Iowan Old Style', default: 'serif' });

export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const lineHeight = {
  subtitle: 34,
} as const;

export const size = {
  /** Bot on iPhone; scale it down with the screen height (see the HTML prototype trap) */
  bot: 265,
  /** Pill buttons of the 18 oct prototype: fully round, thin black outline */
  buttonHeight: 66,
  buttonRadius: 33,
  buttonBorder: 3,
  pillIconSmall: 32,
  pillIconLarge: 69,
  statusIcon: 23,
} as const;

export const spacing = {
  screenX: 18,
  screenTop: 28,
  screenBottom: 32,
  buttonGap: 16,
  /** On iPad and large screens the content stays this wide, centred, like a big iPhone. No effect on phones */
  contentMax: 560,
  /** iPad on its side: two columns (bot left, content right) up to this width, and the space between them */
  wideMax: 1100,
  wideGap: 48,
} as const;

/**
 * Family side (sons and daughters, 45 to 60): same look, smaller sizes.
 * Taken from the approved family HTML prototype.
 */
export const family = {
  fontSize: {
    title: 34,
    subtitle: 19,
    question: 30,
    button: 22,
    body: 18,
    note: 15,
  },
  size: {
    buttonHeight: 60,
    buttonRadius: 30,
    buttonBorder: 3,
  },
} as const;
