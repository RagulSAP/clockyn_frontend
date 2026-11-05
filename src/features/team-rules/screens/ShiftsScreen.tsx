import React, { useState } from 'react';
import { View } from 'react-native';

import * as shiftsApi from '@/api/shifts';
import { ResponsiveRow, Screen } from '@/components/layout';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, IconButton, Reveal, SkeletonList, Text, useConfirm } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId, useSession } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import type { Shift } from '@/types/api/shifts';
import type { StaffMember } from '@/types/api/staff';

import { ActionMenu } from '../components/ActionMenu';
import { AssignStaffSheet } from '../components/AssignStaffSheet';
import { ShiftFormModal } from '../components/ShiftFormModal';
import { useShiftAssignment, useShiftList } from '../hooks/useShifts';
import { formatShiftRange, shiftDurationLabel, type ShiftFormValues } from '../utils/shiftTime';

type FormState = { open: boolean; editing: Shift | null };

/** Shift CRUD and staff assignment (route `/admin/shifts`; managers with the "Shift Management" permission use it too). */
export default function ShiftsScreen() {
  const orgId = useOrgId();
  const session = useSession();
  const confirm = useConfirm();
  const { colors } = useTheme();

  const shiftsQuery = useShiftList();
  const shifts = shiftsQuery.data ?? [];

  const [form, setForm] = useState<FormState>({ open: false, editing: null });
  const [menuId, setMenuId] = useState<number | null>(null);
  const [assignId, setAssignId] = useState<number | null>(null);

  const menuShift = shifts.find((s) => s.id === menuId) ?? null;
  const assignShift = shifts.find((s) => s.id === assignId) ?? null;
  const { assigned, unassigned } = useShiftAssignment(assignId);

  // The staff form (add/edit staff) reads the same shift list: refresh it after every change (replaces v1's cache flags).
  const shiftKeys = [queryKeys.shifts.all(orgId), queryKeys.staff.options(orgId, 'shifts')] as const;

  const saveMutation = useApiMutation(
    async (v: { editing: Shift | null; values: ShiftFormValues }) => {
      const input = { orgId, name: v.values.name, startTime: v.values.startTime, endTime: v.values.endTime };
      return v.editing ? shiftsApi.updateShift(v.editing.id, input) : shiftsApi.createShift(input);
    },
    {
      invalidate: shiftKeys,
      successMessage: (_d, v) => (v.editing ? 'Shift Updated!' : 'Shift Added!'),
      errorMessage: (_e, v) => (v.editing ? 'Failed to update shift' : 'Failed to add shift'),
      onSuccess: () => setForm({ open: false, editing: null }),
    },
  );

  const deleteMutation = useApiMutation((id: number) => shiftsApi.deleteShift(id, orgId), {
    invalidate: [...shiftKeys, queryKeys.staff.all(orgId)],
    successMessage: 'Shift Deleted!',
    errorMessage: 'Failed to delete shift',
  });

  const assignKeys = (id: number) => [queryKeys.shifts.assigned(orgId, id), queryKeys.shifts.unassigned(orgId, id), queryKeys.staff.all(orgId)];

  const assignMutation = useApiMutation((v: { shiftId: number; userIds: string[] }) => shiftsApi.assignStaff({ orgId, shiftId: v.shiftId, userIds: v.userIds }), {
    invalidate: (_d, v) => assignKeys(v.shiftId),
    successMessage: 'Staff assigned!',
    errorMessage: 'Failed to assign staff',
  });

  const unassignMutation = useApiMutation((v: { shiftId: number; userId: string }) => shiftsApi.unassignStaff(orgId, v.userId, v.shiftId), {
    invalidate: (_d, v) => assignKeys(v.shiftId),
    successMessage: 'Staff removed',
    errorMessage: 'Failed to remove staff',
  });

  const onSubmit = async (values: ShiftFormValues) => {
    try {
      await saveMutation.mutateAsync({ editing: form.editing, values });
    } catch {
      // Toast already shown (server detail, e.g. the 18-hour rule); the dialog stays open.
    }
  };

  const onDelete = async (shift: Shift) => {
    const ok = await confirm({
      title: 'Delete Shift',
      message: 'Are you sure you want to delete this shift? This action cannot be undone. Staff on this shift will be unassigned.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(shift.id);
    } catch {
      // Toast already shown.
    }
  };

  const onAssign = async (userIds: string[]): Promise<boolean> => {
    if (assignId === null || userIds.length === 0) return false;
    try {
      await assignMutation.mutateAsync({ shiftId: assignId, userIds });
      return true;
    } catch {
      return false;
    }
  };

  const onUnassign = async (member: StaffMember) => {
    if (assignId === null) return;
    const ok = await confirm({ title: 'Remove from shift', message: `Remove ${member.name} from this shift?`, confirmText: 'Remove', destructive: true });
    if (!ok) return;
    try {
      await unassignMutation.mutateAsync({ shiftId: assignId, userId: member.userId });
    } catch {
      // Toast already shown.
    }
  };

  const loadingFirst = shiftsQuery.isLoading;

  return (
    <Screen
      title="Shift Settings"
      subtitle={session?.orgName || undefined}
      refreshing={shiftsQuery.isRefetching && !shiftsQuery.isLoading}
      onRefresh={() => void shiftsQuery.refetch()}
      footer={<Button title="Add New Shift" icon="plus" size="lg" fullWidth onPress={() => setForm({ open: true, editing: null })} testID="add-shift" />}
      testID="shifts-screen"
    >
      <Reveal index={0}>
      {loadingFirst ? (
        <SkeletonList count={4} />
      ) : shiftsQuery.isError && !shiftsQuery.data ? (
        <ErrorState message={getErrorMessage(shiftsQuery.error, 'Failed to load shifts')} onRetry={() => void shiftsQuery.refetch()} />
      ) : shifts.length === 0 ? (
        <EmptyState icon="clock" title="No shifts yet" message="Add a shift to set working hours and assign staff." action={{ label: 'Add New Shift', icon: 'plus', onPress: () => setForm({ open: true, editing: null }) }} />
      ) : (
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.md}>
          {shifts.map((s) => {
            const duration = shiftDurationLabel(s.startTime, s.endTime);
            return (
              <Card key={s.id} testID={`shift-card-${s.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="clock" size={22} color="primary" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text variant="callout" color="textSecondary">
                      {formatShiftRange(s.startTime, s.endTime)}
                    </Text>
                  </View>
                  {duration ? <Badge label={duration} tone="neutral" size="sm" /> : null}
                  <IconButton icon="more-vertical" variant="plain" accessibilityLabel={`Actions for ${s.name}`} onPress={() => setMenuId(s.id)} testID={`shift-menu-${s.id}`} />
                </View>
              </Card>
            );
          })}
        </ResponsiveRow>
      )}
      </Reveal>

      <ActionMenu
        visible={!!menuShift}
        onClose={() => setMenuId(null)}
        title={menuShift?.name}
        testID="shift-menu"
        items={
          menuShift
            ? [
                { key: 'edit', label: 'Edit', icon: 'edit', onPress: () => setForm({ open: true, editing: menuShift }) },
                { key: 'assign', label: 'Assign Staff', icon: 'users', onPress: () => setAssignId(menuShift.id) },
                { key: 'delete', label: 'Delete', icon: 'trash', destructive: true, onPress: () => void onDelete(menuShift) },
              ]
            : []
        }
      />

      <ShiftFormModal
        visible={form.open}
        editing={form.editing}
        existing={shifts}
        saving={saveMutation.isPending}
        onClose={() => setForm({ open: false, editing: null })}
        onSubmit={onSubmit}
      />

      <AssignStaffSheet
        shift={assignShift}
        assigned={assigned.data}
        unassigned={unassigned.data}
        loading={assigned.isLoading || unassigned.isLoading}
        error={assigned.error ?? unassigned.error}
        assigning={assignMutation.isPending}
        onRetry={() => {
          void assigned.refetch();
          void unassigned.refetch();
        }}
        onAssign={onAssign}
        onUnassign={(m) => void onUnassign(m)}
        onClose={() => setAssignId(null)}
      />
    </Screen>
  );
}
