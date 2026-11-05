/** Clockyn design tokens — spacing, radii, type, motion, elevation. */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

export const radii = { xs: 6, sm: 10, md: 14, lg: 22, xl: 32, pill: 999 } as const;

/** Outfit (geometric, CRED-like) is loaded in the root layout (see src/theme/fonts.ts). Names must match the loaded font keys. */
export const fontFamily = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_500Medium',
  semibold: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
} as const;

type TextVariant = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;
export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title1: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  title2: { fontFamily: fontFamily.bold, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  title3: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  callout: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  micro: { fontFamily: fontFamily.semibold, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.1 },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
} satisfies Record<string, TextVariant>;
export type TypographyVariant = keyof typeof typography;

export const motion = { fast: 140, base: 220, slow: 360 } as const;

/** Cross-platform elevation. Use via spread: `style={[elevation.md(colors.shadow)]}`. */
export const elevation = {
  none: (): ViewStyle => ({}),
  sm: (c: string): ViewStyle => ({ shadowColor: c, shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }),
  md: (c: string): ViewStyle => ({ shadowColor: c, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 }),
  lg: (c: string): ViewStyle => ({ shadowColor: c, shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 10 }),
};

/** Responsive breakpoints for web / tablet layouts. */
export const breakpoints = { tablet: 768, desktop: 1100 } as const;
/** Max content width for wide screens (keeps lists readable). */
export const contentMaxWidth = 1120;
export const tabBarHeight = 64;
export const sidebarWidth = 264;
