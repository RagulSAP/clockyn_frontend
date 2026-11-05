import React from 'react';
import { Pressable, View } from 'react-native';

import { Card, ProgressRing, SnapCarousel, Text } from '@/components/ui';
import { withAlpha } from '@/components/ui/internal/color';
import { spacing, useTheme, type ColorTokens } from '@/theme';

import type { StatFilter } from '../../types';
import type { BucketCounts } from '../../utils/leads';

const CELLS: { key: StatFilter; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'pending', label: 'Pending' },
  { key: 'working', label: 'Working' },
  { key: 'completed', label: 'Completed' },
  { key: 'carry_forward', label: 'Carry Fwd' },
];

function cellColor(colors: ColorTokens, key: StatFilter): string {
  switch (key) {
    case 'unassigned':
      return colors.danger;
    case 'working':
      return colors.warning;
    case 'completed':
      return colors.success;
    case 'carry_forward':
      return colors.statusHalfDay;
    default:
      return colors.primary;
  }
}

export interface StatsGridProps {
  counts: BucketCounts;
  active: StatFilter;
  onSelect: (key: StatFilter) => void;
}

const ITEM_W = 112;
const RING = 100;

type Cell = (typeof CELLS)[number];

function StatRing({ cell, index, counts, selected, onPress }: { cell: Cell; index: number; counts: BucketCounts; selected: boolean; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const color = cellColor(colors, cell.key);
  const value = counts[cell.key];
  const isTotal = cell.key === 'total';
  // Each status is its share of the day's leads; Total is the whole ring.
  const share = isTotal ? (value > 0 ? 1 : 0) : counts.total > 0 ? Math.min(1, value / counts.total) : 0;
  return (
    <Pressable
      testID={`crm-stat-${cell.key}`}
      accessibilityRole="button"
      accessibilityLabel={`${cell.label}, ${value}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: 'center', gap: spacing.sm, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: RING,
          height: RING,
          borderRadius: RING / 2,
          // The chosen status is a filled disc (it filters the list below); the others stay a quiet tint.
          backgroundColor: withAlpha(color, selected ? (isDark ? 0.2 : 0.16) : isDark ? 0.07 : 0.06),
          borderWidth: 2,
          borderColor: selected ? withAlpha(color, 0.4) : 'transparent',
        }}
      >
        <ProgressRing progress={share} color={color} track={colors.border} size={RING - 4} delay={index * 70}>
          <Text variant={value >= 1000 ? 'title1' : 'display'} style={{ color }}>
            {String(value)}
          </Text>
        </ProgressRing>
      </View>
      <Text variant="micro" weight="semibold" align="center" color={selected ? 'text' : 'textMuted'} numberOfLines={1}>
        {cell.label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/** Work Status Overview: Total / Unassigned / Pending / Working / Completed / Carry Fwd as a ring carousel. Tap a ring to filter the list. */
export function StatsGrid({ counts, active, onSelect }: StatsGridProps) {
  const { colors } = useTheme();
  return (
    <Card testID="crm-stats-grid">
      <SnapCarousel
        data={CELLS}
        keyExtractor={(c) => c.key}
        itemWidth={ITEM_W}
        accent={(i) => cellColor(colors, CELLS[i]?.key ?? 'total')}
        dotLabel={(c) => `Show ${c.label}`}
        prevLabel="Previous status"
        nextLabel="Next status"
        itemStyle={({ index, scrollX, step }) => {
          const input = [(index - 1) * step, index * step, (index + 1) * step];
          return {
            opacity: scrollX.interpolate({ inputRange: input, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' }),
            transform: [{ scale: scrollX.interpolate({ inputRange: input, outputRange: [0.92, 1, 0.92], extrapolate: 'clamp' }) }],
          };
        }}
        renderItem={(cell, { index }) => <StatRing cell={cell} index={index} counts={counts} selected={cell.key === active} onPress={() => onSelect(cell.key)} />}
      />
    </Card>
  );
}
