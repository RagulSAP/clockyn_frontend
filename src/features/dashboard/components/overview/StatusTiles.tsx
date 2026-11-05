import React from 'react';
import { Pressable, View } from 'react-native';

import { ResponsiveRow } from '@/components/layout';
import { ProgressRing, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import type { DashboardStats } from '@/types/api/home';

import { tint } from '../../utils/color';
import { OVERVIEW_TILES, type OverviewFilter } from '../../utils/overviewLogic';
import { filterColor } from '../../utils/statusColors';

export type StatusTilesProps = {
  stats: DashboardStats | null | undefined;
  active: OverviewFilter;
  onSelect: (filter: OverviewFilter) => void;
};

const RING = 68;
const STROKE = 4;
const DISC = 52;
const ACTIVE_DISC = 58;

/** Six round status tiles (count + label) wrapped in a ring showing the share of total staff; the active one is emphasised. */
export function StatusTiles({ stats, active, onSelect }: StatusTilesProps) {
  const { colors } = useTheme();
  const total = stats ? stats.totalStaff : 0;
  return (
    <ResponsiveRow columns={{ phone: 3, tablet: 6, desktop: 6 }} gap={spacing.md} testID="status-tiles">
      {OVERVIEW_TILES.map((tile) => {
        const color = filterColor(colors, tile.key);
        const isActive = tile.key === active;
        const size = isActive ? ACTIVE_DISC : DISC;
        const value = stats ? tile.read(stats) : 0;
        const share = tile.key === 'total' ? (value > 0 ? 1 : 0) : total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
        return (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.label}: ${value}`}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(tile.key)}
            testID={`tile-${tile.key}`}
            style={{ alignItems: 'center', gap: spacing.xs }}
          >
            <ProgressRing progress={share} color={color} track={colors.border} size={RING} stroke={STROKE}>
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? color : tint(color, 0.14),
                }}
              >
                <Text variant="title2" style={{ color: isActive ? colors.textInverse : color }} testID={`tile-${tile.key}-value`}>
                  {value}
                </Text>
                {isActive ? <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 1, backgroundColor: colors.textInverse }} /> : null}
              </View>
            </ProgressRing>
            <Text variant="caption" weight={isActive ? 'bold' : 'medium'} color={isActive ? color : 'textSecondary'} align="center" numberOfLines={2}>
              {tile.label}
            </Text>
          </Pressable>
        );
      })}
    </ResponsiveRow>
  );
}
