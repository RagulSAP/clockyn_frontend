import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Button, Checkbox, EmptyState, ErrorState, Icon, Modal, SearchBar, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffMember } from '@/types/api/staff';
import { allVisibleSelected, chipLabel, filterStaff, staffSubtitle, toggleId, toggleSelectAll } from '../targets';

export type StaffPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  staff: StaffMember[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selected: string[];
  onChange: (ids: string[]) => void;
};

/** Multi-select of staff with search, select-all (over the filtered rows) and removable chips. */
export function StaffPickerModal({ visible, onClose, staff, loading, error, onRetry, selected, onChange }: StaffPickerModalProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterStaff(staff, search), [staff, search]);
  const visibleIds = useMemo(() => filtered.map((s) => s.userId), [filtered]);
  const nameById = useMemo(() => new Map(staff.map((s) => [s.userId, s.name])), [staff]);
  const allSelected = allVisibleSelected(selected, visibleIds);

  const close = () => {
    setSearch('');
    onClose();
  };

  let list: React.ReactNode;
  if (loading && staff.length === 0) list = <SkeletonList count={5} variant="row" />;
  else if (error && staff.length === 0) list = <ErrorState compact message={getErrorMessage(error, 'Failed to load staff')} onRetry={onRetry} />;
  else if (filtered.length === 0) list = <EmptyState compact icon="users" title="No staff found" />;
  else {
    list = (
      <View>
        {filtered.map((s) => {
          const checked = selected.includes(s.userId);
          return (
            <Pressable
              key={s.userId}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={s.name}
              onPress={() => onChange(toggleId(selected, s.userId))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
              testID={`staff-row-${s.userId}`}
            >
              <Avatar uri={s.photoUrl} name={s.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {staffSubtitle(s)}
                </Text>
              </View>
              <Checkbox checked={checked} onChange={() => onChange(toggleId(selected, s.userId))} accessibilityLabel={`Select ${s.name}`} />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      onClose={close}
      title="Select Staff"
      size="md"
      testID="staff-picker"
      footer={<Button title={selected.length > 0 ? `Done (${selected.length})` : 'Done'} onPress={close} fullWidth variant={selected.length === 0 ? 'secondary' : 'primary'} testID="staff-picker-done" />}
    >
      <View style={{ gap: spacing.md }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, branch, department…" testID="staff-picker-search" />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allSelected }}
          onPress={() => onChange(toggleSelectAll(selected, visibleIds))}
          disabled={visibleIds.length === 0}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            backgroundColor: colors.surfaceMuted,
          }}
          testID="staff-select-all"
        >
          <Checkbox checked={allSelected} onChange={() => onChange(toggleSelectAll(selected, visibleIds))} accessibilityLabel="Select all" />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            Select All
          </Text>
          <Text variant="caption" color="textMuted">{`${visibleIds.length} staff`}</Text>
        </Pressable>
        {selected.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" color="textSecondary">{`${selected.length} selected`}</Text>
            {/* capped + scrollable: with "Select All" the chips would otherwise push the staff list out of view */}
            <ScrollView style={{ maxHeight: 112 }} nestedScrollEnabled testID="staff-picker-chips">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {selected.map((id) => (
                  <SelectionChip key={id} label={chipLabel(nameById.get(id))} onRemove={() => onChange(toggleId(selected, id))} />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}
        {list}
      </View>
    </Modal>
  );
}

/** Small removable chip (also used by the composer for the chosen recipients). */
export function SelectionChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label}`}
      onPress={onRemove}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs + 2,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        borderRadius: radii.pill,
        backgroundColor: colors.primarySoft,
      }}
    >
      <Text variant="caption" color="primary" weight="semibold">
        {label}
      </Text>
      <Icon name="x" size={14} color="primary" />
    </Pressable>
  );
}
