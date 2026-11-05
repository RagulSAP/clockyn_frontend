import React from 'react';
import { Pressable, View } from 'react-native';

import { ProgressRing, Skeleton, SnapCarousel, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

import { tint } from '../utils/color';
import type { StaffFilter, summaryFigures } from '../utils/dashboardLogic';
import { filterColor } from '../utils/statusColors';

type Figure = ReturnType<typeof summaryFigures>[number];

export type StaffOverviewRingsProps = {
  figures: Figure[];
  /** First load without data: rings render empty with a skeleton number. */
  loading?: boolean;
  onFigurePress: (filter: StaffFilter) => void;
};

const ITEM_W = 112;
const RING = 100;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function FigureRing({ figure, index, total, loading, onPress }: { figure: Figure; index: number; total: number; loading: boolean; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const color = filterColor(colors, figure.key);
  const isTotal = figure.key === 'total';
  const share = isTotal ? (figure.value > 0 ? 1 : 0) : total > 0 ? clamp(figure.value / total, 0, 1) : 0;
  const sub = isTotal ? 'Active staff' : `${Math.round(share * 100)}% of staff`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${figure.label}: ${figure.value}`}
      onPress={onPress}
      testID={`figure-${figure.key}`}
      style={({ pressed }) => ({ alignItems: 'center', gap: spacing.sm, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: RING,
          height: RING,
          borderRadius: RING / 2,
          backgroundColor: tint(color, isDark ? 0.07 : 0.06),
          shadowColor: color,
          shadowOpacity: isDark ? 0.32 : 0.16,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <ProgressRing progress={loading ? 0 : share} color={color} track={colors.border} size={RING} delay={index * 70}>
          {loading ? (
            <Skeleton width={36} height={28} />
          ) : (
            <Text variant={figure.value >= 1000 ? 'title1' : 'display'} style={{ color }} testID={`figure-${figure.key}-value`}>
              {figure.value}
            </Text>
          )}
        </ProgressRing>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variant="callout" weight="semibold" align="center" numberOfLines={2}>
          {figure.label}
        </Text>
        <Text variant="caption" color="textMuted" align="center" numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * "Staff Overview" as a swipeable ring carousel: one progress ring per figure (its share of total staff), the focused
 * ring full size and its neighbours smaller and dimmer.
 */
export function StaffOverviewRings({ figures, loading = false, onFigurePress }: StaffOverviewRingsProps) {
  const { colors } = useTheme();
  const total = figures.find((f) => f.key === 'total')?.value ?? 0;

  return (
    <SnapCarousel
      testID="summary-rings"
      data={figures}
      keyExtractor={(f) => f.key}
      itemWidth={ITEM_W}
      accent={(i) => (figures[i] ? filterColor(colors, figures[i].key) : colors.primary)}
      dotLabel={(f) => `Show ${f.label}`}
      dotsTestID="summary-dots"
      prevTestID="summary-rings-prev"
      nextTestID="summary-rings-next"
      prevLabel="Previous figure"
      nextLabel="Next figure"
      autoPlay
      autoPlayInterval={2800}
      itemStyle={({ index, scrollX, step }) => {
        const input = [(index - 1) * step, index * step, (index + 1) * step];
        return {
          opacity: scrollX.interpolate({ inputRange: input, outputRange: [0.58, 1, 0.58], extrapolate: 'clamp' }),
          transform: [{ scale: scrollX.interpolate({ inputRange: input, outputRange: [0.86, 1, 0.86], extrapolate: 'clamp' }) }],
        };
      }}
      renderItem={(figure, { index }) => (
        <FigureRing figure={figure} index={index} total={total} loading={loading} onPress={() => onFigurePress(figure.key)} />
      )}
    />
  );
}
