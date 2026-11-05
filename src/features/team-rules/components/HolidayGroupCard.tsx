import React from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { holidayDateLabel, plural, type HolidayGroup } from '../utils/holidayLogic';
import type { Holiday } from '@/types/api/system';

export type HolidayGroupCardProps = {
  group: HolidayGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  onMenu: () => void;
  onDeleteDate: (entry: Holiday) => void;
};

/** One holiday (all dates sharing a name, scope and punch policy) in the month list. */
export function HolidayGroupCard({ group, expanded, onToggleExpand, onMenu, onDeleteDate }: HolidayGroupCardProps) {
  const { colors } = useTheme();
  const days = group.entries.length;
  return (
    <Card testID={`holiday-group-${group.key}`}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="title3" color="statusHoliday">
              {String(days)}
            </Text>
            <Text variant="micro" color="textMuted">
              {days === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
            {group.name}
          </Text>
          <IconButton icon="more-vertical" accessibilityLabel={`Actions for ${group.name}`} onPress={onMenu} testID={`holiday-menu-${group.key}`} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          <Badge label={group.branchName || 'All Branches'} tone="primary" size="sm" icon="building" />
          <Badge label={group.deptName || 'All Depts'} tone="neutral" size="sm" icon="tag" />
          {group.blockAttendance ? (
            <Badge label="No Punch" tone="danger" size="sm" icon="x-circle" />
          ) : (
            <Badge label="Punch Allowed" tone="success" size="sm" icon="check-circle" />
          )}
        </View>

        <Button
          title={expanded ? 'Hide Dates' : 'View Dates'}
          variant="ghost"
          size="sm"
          iconRight={expanded ? 'chevron-up' : 'chevron-down'}
          onPress={onToggleExpand}
          style={{ alignSelf: 'flex-start' }}
          testID={`holiday-toggle-${group.key}`}
        />

        {expanded ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {group.entries.map((e) => (
              <View
                key={e.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingLeft: spacing.md,
                  borderRadius: radii.pill,
                  backgroundColor: colors.surfaceMuted,
                }}
              >
                <Text variant="callout">{holidayDateLabel(e.date)}</Text>
                <IconButton
                  icon="x"
                  size="sm"
                  color="danger"
                  accessibilityLabel={`Delete ${group.name} on ${holidayDateLabel(e.date)}`}
                  onPress={() => onDeleteDate(e)}
                  testID={`holiday-delete-date-${e.id}`}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export const holidayCountLabel = (n: number): string => plural(n, 'Holiday', 'Holidays');
