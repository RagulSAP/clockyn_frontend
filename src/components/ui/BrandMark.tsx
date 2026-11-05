import { Image } from 'expo-image';
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { fontFamily } from '@/theme';
import { Text } from './Text';

const LOGO_PNG = require('../../../assets/clockyn-logo.png');
const LOGO_WHITE = '#FFFFFF';

export type BrandMarkVariant = 'mark' | 'wordmark' | 'stacked';

export type BrandMarkProps = {
  /** Height of the mark glyph in px (the wordmark scales with it). Default 40. */
  size?: number;
  variant?: BrandMarkVariant;
  /** `brand` = on light/dark surfaces; `light` = on gradient / dark photo backgrounds. */
  tone?: 'brand' | 'light';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Glyph({ size }: { size: number }) {
  return (
    <Image
      source={LOGO_PNG}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      contentFit="contain"
      accessibilityLabel="Clockyn logo"
      accessibilityRole="image"
    />
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
        <Glyph size={size} />
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
        <Glyph size={size} />
        {word}
      </View>
    );
  }
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel="Clockyn" style={[{ alignItems: 'center', gap: size * 0.12 }, style]}>
      <Glyph size={size} />
      {word}
    </View>
  );
}
