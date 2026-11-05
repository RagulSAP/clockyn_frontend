import React, { useState } from 'react';
import { View } from 'react-native';

import { Avatar, BottomSheet, Button, Card, Checkbox, EmptyState, ErrorState, ListItem, SectionHeader, SkeletonList } from '@/components/ui';
import { getErrorMessage, isApiError } from '@/lib/api/client';
import { spacing } from '@/theme';
import type { StaffMember } from '@/types/api/staff';
import type { Shift } from '@/types/api/shifts';

export type AssignStaffSheetProps = {
  shift: Shift | null;
  assigned: StaffMember[] | undefined;
  unassigned: StaffMember[] | undefined;
  loading: boolean;
  error: unknown;
  assigning: boolean;
  onRetry: () => void;
  onAssign: (userIds: string[]) => Promise<boolean> | boolean;
  onUnassign: (member: StaffMember) => void;
  onClose: () => void;
};

function errorText(error: unknown): string {
  if (isApiError(error) && error.status === 404) return 'Staff assignment is not available on this server yet.';
  return getErrorMessage(error, 'Failed to load staff');
}

/** Assigned / available staff of a shift with bulk assign and per-person remove. */
export function AssignStaffSheet(props: AssignStaffSheetProps) {
  // Keyed by shift: the selection starts empty for every shift.
  return <AssignStaffSheetBody key={props.shift?.id ?? 'none'} {...props} />;
}

function AssignStaffSheetBody({ shift, assigned, unassigned, loading, error, assigning, onRetry, onAssign, onUnassign, onClose }: AssignStaffSheetProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const assignedList = assigned ?? [];
  const available = unassigned ?? [];

  const submit = async () => {
    const ok = await onAssign(selected);
    if (ok) setSelected([]);
  };

  return (
    <BottomSheet
      visible={!!shift}
      onClose={onClose}
      title="Assign Staff"
      snap="tall"
      testID="assign-staff-sheet"
      footer={
        selected.length > 0 ? (
          <Button
            title={assigning ? 'Assigning...' : `Assign ${selected.length} Staff`}
            fullWidth
            loading={assigning}
            onPress={() => void submit()}
            testID="assign-submit"
          />
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonList count={4} />
      ) : error ? (
        <ErrorState message={errorText(error)} onRetry={onRetry} compact />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {assignedList.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={`ASSIGNED (${assignedList.length})`} />
              <Card padding={0} variant="outlined">
                {assignedList.map((m, i) => (
                  <ListItem
                    key={m.userId}
                    left={<Avatar name={m.name} size={36} />}
                    title={m.name}
                    subtitle={m.empId}
                    right={<Button title="Remove" size="sm" variant="ghost" onPress={() => onUnassign(m)} testID={`unassign-${m.userId}`} />}
                    divider={i < assignedList.length - 1}
                  />
                ))}
              </Card>
            </View>
          ) : null}
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={`AVAILABLE (${available.length})`} />
            {available.length === 0 ? (
              <EmptyState icon="check-circle" title="All staff assigned" compact />
            ) : (
              <Card padding={0} variant="outlined">
                {available.map((m, i) => (
                  <ListItem
                    key={m.userId}
                    left={<Checkbox checked={selected.includes(m.userId)} onChange={() => toggle(m.userId)} accessibilityLabel={`Select ${m.name}`} />}
                    title={m.name}
                    subtitle={m.empId}
                    onPress={() => toggle(m.userId)}
                    chevron={false}
                    divider={i < available.length - 1}
                    testID={`available-${m.userId}`}
                  />
                ))}
              </Card>
            )}
          </View>
        </View>
      )}
    </BottomSheet>
  );
}
