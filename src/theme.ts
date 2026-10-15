/**
 * Hilo design tokens, taken from the Figma v1 (APP Home, APP speech, APP pills).
 * Font: the system font (SF Pro on iPhone/iPad, Roboto on Android), so no fontFamily is set.
 * SF Pro "Semibold" (590) maps to '600', "Heavy" (860) to '800'.
 */

export const colors = {
  background: '#ffffff',
  ink: '#000000',
  /** Subtitles, times, secondary text. Figma had #a5a5a5 / #898989, darkened for older eyes. */
  muted: '#767676',
  sage: '#8fa88a',
  /** Ripple ring and progress tracks */
  sageSoft: 'rgba(143, 168, 138, 0.35)',
  /** Pill taken / not taken icons, from the Figma */
  taken: '#1dd900',
  missed: '#d70606',
} as const;

export const fontSize = {
  title: 40,
  subtitle: 26,
  button: 30,
  holdButton: 24,
  pillName: 26,
  talk: 20,
  status: 20,
  count: 20,
  label: 18,
  time: 14,
} as const;

export const fontWeight = {
  semibold: '600',
  heavy: '800',
} as const;

export const lineHeight = {
  subtitle: 34,
} as const;

export const size = {
  /** Bot on iPhone; scale it down with the screen height (see the HTML prototype trap) */
  bot: 265,
  buttonHeight: 69,
  buttonRadius: 34.5,
  buttonBorder: 5,
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
    buttonBorder: 4,
  },
} as const;
