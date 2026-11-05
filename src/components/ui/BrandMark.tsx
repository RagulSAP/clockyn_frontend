import React, { useId } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { fontFamily, useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Clockyn mark: a clock ring that is intentionally left open at the top-right, with a mint "punch" dot
 * sitting in the gap, and two clock hands. Geometry (100 x 100 viewBox) is mirrored by the raster
 * assets in `assets/` (icon, splash, favicon, adaptive and notification icons).
 */
/** Brand constant: the light logo variant is always pure white (independent of theme). */
const LOGO_WHITE = '#FFFFFF';
const C = 50;
const R = 34;
const RING_W = 9;
const HAND_W = 7;
const GAP_START = 335; // degrees, clockwise from 3 o'clock (SVG convention)
const GAP_END = 275;
const DOT_ANGLE = 305;
const DOT_R = 6.5;

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number, r = R) => ({ x: C + r * Math.cos(rad(deg)), y: C + r * Math.sin(rad(deg)) });
const f = (n: number) => n.toFixed(2);

const a = pt(GAP_START);
const b = pt(GAP_END);
const dot = pt(DOT_ANGLE);
const RING_PATH = `M ${f(a.x)} ${f(a.y)} A ${R} ${R} 0 1 1 ${f(b.x)} ${f(b.y)}`;
const HANDS_PATH = 'M 50 50 L 50 31 M 50 50 L 62 58';

export type BrandMarkVariant = 'mark' | 'wordmark' | 'stacked';

export type BrandMarkProps = {
  /** Height of the mark glyph in px (the wordmark scales with it). Default 40. */
  size?: number;
  variant?: BrandMarkVariant;
  /** `brand` = metallic (text to muted) ring on light/dark surfaces; `light` = white ring for use on gradient / dark photo backgrounds. */
  tone?: 'brand' | 'light';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Glyph({ size, tone }: { size: number; tone: 'brand' | 'light' }) {
  const { colors } = useTheme();
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ink = tone === 'light' ? LOGO_WHITE : `url(#${gid})`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="Clockyn logo">
      {tone === 'brand' ? (
        <Defs>
          <LinearGradient id={gid} x1="12" y1="10" x2="88" y2="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.text} />
            <Stop offset="1" stopColor={colors.textMuted} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path d={RING_PATH} stroke={ink} strokeWidth={RING_W} strokeLinecap="round" fill="none" />
      <Path d={HANDS_PATH} stroke={ink} strokeWidth={HAND_W} strokeLinecap="round" fill="none" />
      <Circle cx={dot.x} cy={dot.y} r={DOT_R} fill={colors.accent} />
    </Svg>
  );
}

export function BrandMark({ size = 40, variant = 'mark', tone = 'brand', style, testID }: BrandMarkProps) {
  const word = (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      color={tone === 'light' ? LOGO_WHITE : 'text'}
      style={{ fontFamily: fontFamily.extrabold, fontSize: size * 0.62, lineHeight: size * 0.8, letterSpacing: -size * 0.02 }}
    >
      Clockyn
    </Text>
  );

  if (variant === 'mark') {
    return (
      <View testID={testID} style={style}>
        <Glyph size={size} tone={tone} />
      </View>
    );
  }
  if (variant === 'wordmark') {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel="Clockyn"
        style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }, style]}
      >
        <Glyph size={size} tone={tone} />
        {word}
      </View>
    );
  }
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel="Clockyn" style={[{ alignItems: 'center', gap: size * 0.12 }, style]}>
      <Glyph size={size} tone={tone} />
      {word}
    </View>
  );
}
