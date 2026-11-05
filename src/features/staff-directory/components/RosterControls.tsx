import React from 'react';
import { View } from 'react-native';

import { Card, FilterChips, Icon, SearchBar, Text, type ChipOption } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { ChipCounts, RoleChip, RosterBanner } from '../utils/rosterFilters';

export interface RosterControlsProps {
  search: string;
  onSearchChange: (text: string) => void;
  role: RoleChip;
  onRoleChange: (role: RoleChip) => void;
  counts: ChipCounts;
  banner: RosterBanner | null;
}

/** Search box, role chips (with counts) and the Absent / Late banner above the roster. */
export function RosterControls({ search, onSearchChange, role, onRoleChange, counts, banner }: RosterControlsProps) {
  const { colors } = useTheme();
  const options: ChipOption<RoleChip>[] = [
    { label: 'All', value: 'all', icon: 'users', count: counts.all },
    { label: 'Staff', value: 'staff', icon: 'user', count: counts.staff },
    { label: 'Manager', value: 'manager', icon: 'shield-check', count: counts.manager },
    { label: 'Inactive', value: 'inactive', icon: 'user-minus', count: counts.inactive },
  ];
  const tone = banner?.tone === 'danger' ? { bg: colors.dangerSoft, fg: colors.danger } : { bg: colors.warningSoft, fg: colors.warning };

  return (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <SearchBar value={search} onChangeText={onSearchChange} placeholder="Search by name, branch, dept..." testID="roster-search" />
      <FilterChips<RoleChip> options={options} value={role} onChange={onRoleChange} testID="roster-chips" />
      {banner ? (
        <Card variant="muted" padding={spacing.md} style={{ backgroundColor: tone.bg }} testID="roster-banner">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
              <Icon name={banner.tone === 'danger' ? 'user-x' : 'clock'} size={18} color={tone.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" color={tone.fg}>
                {banner.title}
              </Text>
              <Text variant="caption" color={tone.fg}>
                {banner.subtitle}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
