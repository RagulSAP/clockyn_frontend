import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { bucketSlug, bucketVisual, type FaqBucket, type FaqTone } from '../utils/faq';

/** Tinted square with the bucket icon (tile and desktop list). */
export function BucketIcon({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const { icon, tone } = bucketVisual(name);
  const soft: Record<FaqTone, string> = {
    info: colors.infoSoft,
    success: colors.successSoft,
    warning: colors.warningSoft,
    accent: colors.accentSoft,
    danger: colors.dangerSoft,
    primary: colors.primarySoft,
  };
  return (
    <View style={{ width: size, height: size, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: soft[tone] }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={tone} />
    </View>
  );
}

export const questionsLabel = (n: number) => `${n} ${n === 1 ? 'question' : 'questions'}`;

/** Landing tile of one bucket: icon, name, "N questions" and a muted one-line list of its categories. */
export function FaqBucketTile({ bucket, onPress, width }: { bucket: FaqBucket; onPress: () => void; width: `${number}%` }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`faq-bucket-${bucketSlug(bucket.name)}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        width,
        flexGrow: 0,
        flexShrink: 0,
        gap: spacing.sm,
        padding: spacing.lg,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: hovered ? colors.primary : colors.border,
        backgroundColor: pressed || hovered ? colors.surfaceMuted : colors.surface,
      })}
    >
      <BucketIcon name={bucket.name} />
      <View style={{ gap: 2 }}>
        <Text variant="bodyStrong" weight="semibold">
          {bucket.name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {questionsLabel(bucket.count)}
        </Text>
      </View>
      <Text variant="micro" color="textMuted" numberOfLines={2}>
        {bucket.categories.join(' · ')}
      </Text>
    </Pressable>
  );
}
