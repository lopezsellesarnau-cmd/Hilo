/**
 * Staff web tokens, from the hilo-web site and the staff canvas (25 Oct). Only for src/staff and src/app/staff:
 * the family and senior app keep using src/theme.ts, so a change here can't move anything there.
 */

export const staffColors = {
  page: '#ffffff',
  ink: '#141310',
  /** Grey blocks and inputs */
  block: '#f4f4f4',
  /** Active row in the sidebar */
  active: '#f2f2f0',
  line: '#e6e6e3',
  muted: '#6b6b6b',
  soft: '#3a3a3a',
  error: '#b3261e',
} as const;

export const staffFont = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export const staffText = {
  title: { fontFamily: staffFont, fontSize: 40, fontWeight: '500', letterSpacing: -1.4, color: staffColors.ink },
  body: { fontFamily: staffFont, fontSize: 16, lineHeight: 24, color: staffColors.ink },
  note: { fontFamily: staffFont, fontSize: 14, lineHeight: 20, color: staffColors.muted },
  /** Small uppercase labels */
  label: {
    fontFamily: staffFont,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: staffColors.muted,
  },
} as const;
