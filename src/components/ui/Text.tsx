import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { fontFamily, useTheme, type ColorTokens, type TypographyVariant } from '@/theme';

export type ColorProp = keyof ColorTokens | (string & {});

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  /** A colour token name (preferred) or a raw colour string. Defaults to `text`. */
  color?: ColorProp;
  align?: TextStyle['textAlign'];
  /** Override the font weight of the variant. */
  weight?: keyof typeof fontFamily;
};

/** Resolve a colour token name or raw string against the active theme. */
export function resolveColor(colors: ColorTokens, color: ColorProp | undefined, fallback: keyof ColorTokens = 'text'): string {
  if (!color) return colors[fallback];
  return color in colors ? colors[color as keyof ColorTokens] : color;
}

export function Text({ variant = 'body', color, align, weight, style, maxFontSizeMultiplier = 1.4, ...rest }: TextProps) {
  const { colors, typography } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[
        typography[variant],
        { color: resolveColor(colors, color) },
        weight ? { fontFamily: fontFamily[weight] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
