import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme } from '@/theme';
import { toneColors, type Tone } from './Badge';
import { Card } from './Card';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Skeleton } from './Skeleton';
import { Text } from './Text';

export type StatTrend = {
  /** Display text such as `+12%`. */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** Whether this direction is good news (colours the trend). Defaults to up = good. */
  positive?: boolean;
};

export type StatCardProps = {
  label: string;
  value: string | number;
  icon?: IconName;
  tone?: Tone;
  onPress?: () => void;
  trend?: StatTrend;
  /** Small text under the value. */
  caption?: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Long values (amounts such as ₹4,08,000) step the size down: `adjustsFontSizeToFit` does nothing on web and they got cut with "...". */
function valueSize(text: string): { fontSize: number; lineHeight: number } {
  const n = text.length;
  if (n <= 7) return { fontSize: 28, lineHeight: 34 };
  if (n <= 9) return { fontSize: 22, lineHeight: 34 };
  if (n <= 12) return { fontSize: 18, lineHeight: 34 };
  return { fontSize: 15, lineHeight: 34 };
}

export function StatCard({ label, value, icon, tone = 'primary', onPress, trend, caption, loading, style, testID }: StatCardProps) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  const good = trend ? (trend.positive ?? trend.direction !== 'down') : true;
  const trendColor = trend?.direction === 'flat' ? colors.textMuted : good ? colors.success : colors.danger;
  return (
    <Card
      testID={testID}
      onPress={onPress}
      padding={spacing.lg}
      accessibilityLabel={`${label}: ${value}`}
      style={[{ minWidth: 140 }, style]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="callout" color="textSecondary" numberOfLines={2} style={{ flex: 1 }}>
          {label}
        </Text>
        {icon ? (
          <View style={{ width: 36, height: 36, borderRadius: radii.sm + 2, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={18} color={t.fg} />
          </View>
        ) : null}
      </View>
      {loading ? (
        <Skeleton width={72} height={28} style={{ marginTop: spacing.md }} />
      ) : (
        <Text variant="display" style={{ marginTop: spacing.sm, ...valueSize(String(value)) }} numberOfLines={1} adjustsFontSizeToFit>
          {String(value)}
        </Text>
      )}
      {trend || caption ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
          {trend ? (
            <>
              <Icon name={trend.direction === 'up' ? 'trending-up' : trend.direction === 'down' ? 'trending-down' : 'minus'} size={14} color={trendColor} />
              <Text variant="caption" weight="semibold" color={trendColor}>
                {trend.value}
              </Text>
            </>
          ) : null}
          {caption ? (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {caption}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
