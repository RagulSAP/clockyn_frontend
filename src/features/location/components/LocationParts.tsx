import React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffLocation } from '@/types/api/location';

import { freshnessOf, lastUpdatedLabel, staffStatus } from '../utils/freshness';

export type PanelKind = 'recent' | 'outdated' | 'all';

/** Full-page panel shown when the plan does not include live staff location. */
export function PlanLockedPanel({ message, canBuy, onRenew }: { message: string; canBuy: boolean; onRenew: () => void }) {
  return (
    <Card>
      <EmptyState
        icon="lock"
        title="Page Unavailable"
        message={message}
        action={canBuy ? { label: Platform.OS === 'ios' ? 'View Plan Status' : 'Renew Plan', onPress: onRenew } : undefined}
      />
    </Card>
  );
}

function FreshDot({ staff, now }: { staff: StaffLocation; now: number }) {
  const { colors } = useTheme();
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: freshnessOf(staff, now) === 'fresh' ? colors.success : colors.danger }} />;
}

function StaffRow({ staff, now, selected, showStatus, onPress }: { staff: StaffLocation; now: number; selected: boolean; showStatus: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const updated = lastUpdatedLabel(staff.updatedAt);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Show ${staff.name} on the map`}
      testID={`location-row-${staff.userId}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent',
      })}
    >
      <Avatar name={staff.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {staff.name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {`${staff.empId} • ${staff.branch}`}
        </Text>
        {updated ? (
          <Text variant="caption" color="textSecondary">{`Last updated: ${updated}`}</Text>
        ) : showStatus ? (
          <Text variant="caption" color={colors.warning}>
            No location data yet
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <FreshDot staff={staff} now={now} />
        {showStatus ? (
          <Text variant="micro" color="textMuted">
            {staffStatus(staff)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const TITLES: Record<PanelKind, string> = {
  recent: 'Recently Updated Staff',
  outdated: 'Outdated Location Staff',
  all: 'All Field Staff',
};

/** Drill-down list under / beside the map: recent / outdated (from the counters) or all field staff. */
export function StaffPanel({
  kind,
  staff,
  now,
  selectedId,
  onSelect,
  onClose,
  maxHeight,
}: {
  kind: PanelKind;
  staff: StaffLocation[];
  now: number;
  selectedId: string | null;
  onSelect: (s: StaffLocation) => void;
  onClose: () => void;
  maxHeight: number;
}) {
  const { colors } = useTheme();
  const head = kind === 'recent' ? colors.successSoft : kind === 'outdated' ? colors.dangerSoft : colors.primarySoft;
  return (
    <Card padding={0} testID={`location-panel-${kind}`} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: head }}>
        <Text variant="bodyStrong">{`${TITLES[kind]} (${staff.length})`}</Text>
        <IconButton icon="x" variant="plain" accessibilityLabel="Close list" onPress={onClose} />
      </View>
      <ScrollView style={{ maxHeight }} nestedScrollEnabled contentContainerStyle={{ padding: spacing.sm }}>
        {staff.length === 0 ? (
          <Text variant="body" color="textMuted" align="center" style={{ padding: spacing.xl }}>
            {kind === 'all' ? 'No field staff found for this date' : 'No staff in this list'}
          </Text>
        ) : (
          staff.map((s) => (
            <StaffRow key={s.userId} staff={s} now={now} selected={selectedId === s.userId} showStatus={kind === 'all'} onPress={() => onSelect(s)} />
          ))
        )}
      </ScrollView>
    </Card>
  );
}

export function ViewAllButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <Button title={`View All Staff (${count})`} icon="users" onPress={onPress} fullWidth testID="location-view-all" />;
}
