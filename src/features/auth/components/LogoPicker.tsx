import React from 'react';
import { Image, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export type LogoPickerProps = {
  uri: string | null;
  onPick: () => void;
};

/** Square logo box: tap to choose / change the company logo (uploaded after registration). */
export function LogoPicker({ uri, onPick }: LogoPickerProps) {
  const { colors } = useTheme();
  return (
    <Card variant="muted" onPress={onPick} padding={spacing.md} accessibilityLabel={uri ? 'Change company logo' : 'Upload company logo'} testID="logo-picker">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radii.md,
            borderWidth: uri ? 0 : 1.5,
            borderStyle: 'dashed',
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {uri ? <Image source={{ uri }} style={{ width: 72, height: 72 }} resizeMode="cover" accessibilityLabel="Company logo preview" /> : <Icon name="building-2" size={28} color="textMuted" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Company Logo</Text>
          <Text variant="callout" color="textSecondary">
            {uri ? 'Tap to change logo' : 'Tap to upload logo'}
          </Text>
        </View>
        <Icon name="image-plus" size={20} color="primary" />
      </View>
    </Card>
  );
}
