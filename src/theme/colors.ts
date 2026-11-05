/**
 * Clockyn design tokens — colour.
 * Look: CRED-inspired. Near-black canvas, raised graphite surfaces with a hairline top highlight, a monochrome
 * primary (white on dark, black on light) and vivid colour kept for meaning only (status, money, alerts).
 * Two themes (light/dark). Never hard-code colours in screens; read them from `useTheme().colors`.
 * Text/surface pairs meet WCAG AA (4.5:1; see docs/qa/cross-cutting-Q5.md and docs/changes/cred-theme.md).
 */
export type ColorTokens = {
  // surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  overlay: string;
  border: string;
  borderStrong: string;
  /** Lit top edge of a raised surface (the neumorphic bevel). */
  highlight: string;
  // text
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  // brand
  primary: string;
  primaryPressed: string;
  primarySoft: string; // tinted background for primary chips
  onPrimary: string;
  accent: string; // mint
  accentSoft: string;
  gradientStart: string;
  gradientEnd: string;
  /** Text / icons on the gradient (hero) surfaces. Always light: the gradient is graphite in both themes. */
  onGradient: string;
  // semantic
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  // attendance status colours (functional meaning — keep consistent app-wide)
  statusPresent: string;
  statusAbsent: string;
  statusLate: string;
  statusHalfDay: string;
  statusLeave: string;
  statusHoliday: string;
  statusWeekOff: string;
  // misc
  skeleton: string;
  shadow: string;
  tabBar: string;
};

export const lightColors: ColorTokens = {
  background: '#F2F1EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#ECEAE5',
  overlay: 'rgba(10,10,10,0.55)',
  border: '#E1DFD9',
  borderStrong: '#C4C1B8',
  highlight: 'rgba(255,255,255,1)',
  text: '#0D0D0D',
  textSecondary: '#454545',
  textMuted: '#666666',
  textInverse: '#FFFFFF',
  primary: '#0D0D0D',
  primaryPressed: '#2B2B2B',
  primarySoft: '#E9E7E1',
  onPrimary: '#FFFFFF',
  accent: '#06C270',
  accentSoft: '#D8F4E6',
  gradientStart: '#2E2E31',
  gradientEnd: '#0F0F10',
  onGradient: '#FFFFFF',
  success: '#0A7A4B',
  successSoft: '#DCF3E8',
  warning: '#9A6200',
  warningSoft: '#FFF0D2',
  danger: '#D92D20',
  dangerSoft: '#FDE9E7',
  info: '#1D4ED8',
  infoSoft: '#E4ECFF',
  statusPresent: '#0A7A4B',
  statusAbsent: '#D92D20',
  statusLate: '#9A6200',
  statusHalfDay: '#6D4AE0',
  statusLeave: '#1D4ED8',
  statusHoliday: '#C2327D',
  statusWeekOff: '#666666',
  skeleton: '#E4E1DA',
  shadow: '#000000',
  tabBar: 'rgba(255,255,255,0.94)',
};

export const darkColors: ColorTokens = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1A1A1A',
  surfaceMuted: '#232323',
  overlay: 'rgba(0,0,0,0.74)',
  border: '#292929',
  borderStrong: '#404040',
  highlight: 'rgba(255,255,255,0.13)',
  text: '#F5F5F5',
  textSecondary: '#C4C4C4',
  textMuted: '#939393',
  textInverse: '#0A0A0A',
  primary: '#F5F5F5',
  primaryPressed: '#D6D6D6',
  primarySoft: '#262626',
  onPrimary: '#0A0A0A',
  accent: '#34E3A5',
  accentSoft: '#0E2E24',
  gradientStart: '#303034',
  gradientEnd: '#111112',
  onGradient: '#FFFFFF',
  success: '#34D98F',
  successSoft: '#0E2B20',
  warning: '#FFC531',
  warningSoft: '#2D2410',
  danger: '#FF5C4D',
  dangerSoft: '#301512',
  info: '#6C9BFF',
  infoSoft: '#14203A',
  statusPresent: '#34D98F',
  statusAbsent: '#FF5C4D',
  statusLate: '#FFC531',
  statusHalfDay: '#B39BFF',
  statusLeave: '#6C9BFF',
  statusHoliday: '#FF7AB6',
  statusWeekOff: '#8A8A8A',
  skeleton: '#232323',
  shadow: '#000000',
  tabBar: 'rgba(20,20,20,0.94)',
};
