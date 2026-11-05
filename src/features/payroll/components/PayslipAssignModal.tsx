import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { spacing } from '@/theme';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  ListItem,
  Modal,
  Select,
  SkeletonList,
  Text,
  useToast,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { assignPayslip, listPayslipStaff, listSalaryBranches, listSalaryDepartments } from '@/api/payroll';
import { getErrorMessage, isApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import type { PayslipStaffRow, PayslipTemplate } from '@/types/api/payroll';
import { PayslipPreviewModal } from './PayslipPreviewModal';

export interface PayslipAssignModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string;
  template: PayslipTemplate | null;
}

/** `payslip_name` of the payslip the staff member is already on, when the server reported it with the failure. */
export function alreadyAssignedPayslip(error: unknown): string | null {
  if (!isApiError(error)) return null;
  const raw = error.raw;
  if (typeof raw === 'object' && raw !== null && 'payslip_name' in raw) {
    const name = (raw as { payslip_name?: unknown }).payslip_name;
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return null;
}

/**
 * Assigns a payslip template to ONE staff member at a time, with Branch / Department filters (server side), the
 * per-staff payslip preview and the "already assigned to another payslip" notice. Assigned state comes from the
 * server's `is_assigned` flag (keyed by `staff_id`) plus rows assigned in this session.
 */
export function PayslipAssignModal({ visible, onClose, orgId, template }: PayslipAssignModalProps) {
  const session = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const templateId = template?.id ?? null;
  const enabled = visible && !!templateId && !!orgId;

  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [justAssigned, setJustAssigned] = useState<string[]>([]);
  const [previewStaffId, setPreviewStaffId] = useState<string | null>(null);
  const [alreadyOn, setAlreadyOn] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Filters and session state reset every time the dialog opens for a template (adjusted during render, no effect).
  const sessionKey = visible ? (templateId ?? '') : '';
  const [lastSessionKey, setLastSessionKey] = useState(sessionKey);
  if (lastSessionKey !== sessionKey) {
    setLastSessionKey(sessionKey);
    setBranchId('');
    setDepartmentId('');
    setJustAssigned([]);
    setPreviewStaffId(null);
  }

  const branches = useQuery({ queryKey: queryKeys.payroll.filters(orgId, 'branches'), queryFn: () => listSalaryBranches(orgId), enabled });
  const departments = useQuery({
    queryKey: queryKeys.payroll.filters(orgId, 'departments'),
    queryFn: () => listSalaryDepartments(orgId),
    enabled,
  });
  const staff = useQuery({
    queryKey: queryKeys.payroll.staff(orgId, 'payslip', { templateId, branchId, departmentId }),
    queryFn: () => listPayslipStaff(orgId, { branchId, departmentId, payslipId: templateId }),
    enabled,
  });

  const assignAction = useAsyncAction(
    async (staffId: string) => {
      if (!templateId) return false;
      setAssigningId(staffId);
      try {
        await assignPayslip(orgId, staffId, templateId);
      } finally {
        setAssigningId(null);
      }
      return true;
    },
    {
      silentError: true,
      onError: (error) => {
        const existing = alreadyAssignedPayslip(error);
        if (existing) setAlreadyOn(existing);
        else toast.error(getErrorMessage(error, 'Failed to assign payslip'));
      },
    },
  );

  const assign = async (row: PayslipStaffRow) => {
    const ok = await assignAction.run(row.staffId);
    if (ok) {
      setJustAssigned((prev) => (prev.includes(row.staffId) ? prev : [...prev, row.staffId]));
      toast.success('Payslip Assigned!');
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all(orgId) });
    }
  };

  const rows = staff.data ?? [];
  const branchOptions = [{ label: 'All Branches', value: '' }, ...(branches.data ?? []).map((b) => ({ label: b.name, value: b.id }))];
  const departmentOptions = [
    { label: 'All Departments', value: '' },
    ...(departments.data ?? []).map((d) => ({ label: d.name, value: d.id })),
  ];

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={session?.orgName || 'Company'}
      size="md"
      testID="payslip-assign-modal"
      footer={<Button title="Close" variant="secondary" fullWidth onPress={onClose} />}
    >
      <View style={{ gap: spacing.lg }}>
        {template ? (
          <Text variant="callout" color="textSecondary">
            {template.name}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Select<string>
            style={{ flex: 1 }}
            label="Branch"
            title="Branch"
            value={branchId}
            options={branchOptions}
            onChange={setBranchId}
            testID="filter-branch"
          />
          <Select<string>
            style={{ flex: 1 }}
            label="Department"
            title="Department"
            value={departmentId}
            options={departmentOptions}
            onChange={setDepartmentId}
            testID="filter-department"
          />
        </View>

        <Text variant="title3">Staff Details</Text>

        {staff.isLoading ? <SkeletonList count={4} /> : null}
        {!staff.isLoading && staff.isError ? <ErrorState message="Failed to load staff" onRetry={() => void staff.refetch()} compact /> : null}
        {!staff.isLoading && !staff.isError && rows.length === 0 ? (
          <EmptyState icon="users" title="No staff found" message="Try a different branch or department." compact />
        ) : null}

        {rows.map((row) => {
          const assigned = row.isAssigned || justAssigned.includes(row.staffId);
          return (
            <ListItem
              key={row.staffId}
              testID={`payslip-staff-${row.staffId}`}
              left={<Avatar name={row.name} size={40} />}
              title={row.name}
              subtitle={`${row.departmentName} | ${row.branchName}`}
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.xs, minWidth: 172 }}>
                  <IconButton
                    icon="eye"
                    variant="tonal"
                    accessibilityLabel={`Preview payslip for ${row.name}`}
                    onPress={() => setPreviewStaffId(row.staffId)}
                    testID={`preview-${row.staffId}`}
                  />
                  {assigned ? (
                    <Badge label="Assigned" tone="success" icon="check" />
                  ) : (
                    <Button
                      title="Assign"
                      size="sm"
                      loading={assigningId === row.staffId}
                      disabled={assignAction.loading}
                      onPress={() => void assign(row)}
                      testID={`assign-${row.staffId}`}
                    />
                  )}
                </View>
              }
            />
          );
        })}
      </View>

      <PayslipPreviewModal
        visible={previewStaffId !== null}
        onClose={() => setPreviewStaffId(null)}
        orgId={orgId}
        payslipId={templateId}
        staffId={previewStaffId}
      />

      <ConfirmDialog
        visible={alreadyOn !== null}
        title="Already Assigned"
        message={alreadyOn ? `This staff member is already assigned to "${alreadyOn}"` : undefined}
        confirmText="OK"
        hideCancel
        onCancel={() => setAlreadyOn(null)}
        onConfirm={() => setAlreadyOn(null)}
        testID="already-assigned"
      />
    </Modal>
  );
}
