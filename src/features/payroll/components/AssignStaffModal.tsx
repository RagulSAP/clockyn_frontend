import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { radii, spacing, useTheme } from '@/theme';
import {
  Avatar,
  Button,
  ConfirmDialog,
  ErrorState,
  Icon,
  ListItem,
  Modal,
  SkeletonList,
  Text,
  useToast,
  CheckboxMark,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';
import type { AssignableStaff, AssignmentSide } from '@/types/api/payroll';
import type { PayrollKind } from '../types';

export interface AssignStaffModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string;
  kind: PayrollKind;
  templateId: string | null;
  /** Dialog title ("Assign Staff", bonus: "Staff Details"). */
  title: string;
  /** Optional note under the title. */
  hint?: string;
  listStaff: (orgId: string, templateId: string, side: AssignmentSide) => Promise<AssignableStaff[]>;
  assign: (orgId: string, userIds: string[], templateId: string) => Promise<void>;
  unassign: (orgId: string, userId: string, templateId: string) => Promise<void>;
  /** Staff ids that need a confirmation before they are selected (bonus: already on another bonus). */
  loadWarnIds?: () => Promise<string[]>;
  warnTitle?: string;
  warnMessage?: (staffName: string) => string;
}

const subtitleOf = (s: AssignableStaff): string => [s.empId, s.branchName].filter((part) => part !== '').join(' • ');

/**
 * Assign / remove staff of one template (wages and incentives): ASSIGNED list with Remove, AVAILABLE list with
 * multi-select and a bulk "Assign {k} Staff" action. Lists are keyed by template (no stale rows from the previous one)
 * and a load failure shows a retry state instead of silently keeping old data.
 */
export function AssignStaffModal({
  visible,
  onClose,
  orgId,
  kind,
  templateId,
  title,
  hint,
  listStaff,
  assign,
  unassign,
  loadWarnIds,
  warnTitle = 'Already Assigned',
  warnMessage,
}: AssignStaffModalProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();
  const enabled = visible && !!templateId && !!orgId;

  const assignedQuery = useQuery({
    queryKey: queryKeys.payroll.staff(orgId, kind, { templateId, side: 'assigned' }),
    queryFn: () => listStaff(orgId, templateId as string, 'assigned'),
    enabled,
  });
  const availableQuery = useQuery({
    queryKey: queryKeys.payroll.staff(orgId, kind, { templateId, side: 'unassigned' }),
    queryFn: () => listStaff(orgId, templateId as string, 'unassigned'),
    enabled,
  });
  // A failed warning lookup must not block assignment: the confirmation is just skipped.
  const warnQuery = useQuery({
    queryKey: queryKeys.payroll.staff(orgId, kind, { templateId, side: 'warn' }),
    queryFn: () => (loadWarnIds ? loadWarnIds() : Promise.resolve([] as string[])),
    enabled: enabled && !!loadWarnIds,
  });

  const [selected, setSelected] = useState<string[]>([]);
  const [warnStaff, setWarnStaff] = useState<AssignableStaff | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Selection and warning reset whenever the dialog closes or switches template (adjusted during render, no effect).
  const sessionKey = visible ? (templateId ?? '') : '';
  const [lastSessionKey, setLastSessionKey] = useState(sessionKey);
  if (lastSessionKey !== sessionKey) {
    setLastSessionKey(sessionKey);
    setSelected([]);
    setWarnStaff(null);
  }

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all(orgId) });
  }, [queryClient, orgId]);

  const assignAction = useAsyncAction(
    async () => {
      if (!templateId || selected.length === 0) return 0;
      await assign(orgId, selected, templateId);
      return selected.length;
    },
    {
      errorMessage: 'Failed to assign staff',
      onSuccess: (count) => {
        if (count > 0) toast.success(`${count} staff assigned!`);
        setSelected([]);
        refreshAll();
      },
    },
  );

  const removeAction = useAsyncAction(
    async (userId: string) => {
      if (!templateId) return;
      setRemovingId(userId);
      try {
        await unassign(orgId, userId, templateId);
      } finally {
        setRemovingId(null);
      }
    },
    {
      errorMessage: 'Failed to unassign',
      successMessage: 'Staff unassigned',
      onSuccess: () => refreshAll(),
    },
  );

  const warnIds = warnQuery.data ?? [];
  const toggle = (staff: AssignableStaff) => {
    if (selected.includes(staff.userId)) {
      setSelected((prev) => prev.filter((id) => id !== staff.userId));
    } else if (warnIds.includes(staff.userId)) {
      setWarnStaff(staff);
    } else {
      setSelected((prev) => [...prev, staff.userId]);
    }
  };

  const assigned = assignedQuery.data ?? [];
  const available = availableQuery.data ?? [];
  const loading = assignedQuery.isLoading || availableQuery.isLoading;
  const failed = assignedQuery.isError || availableQuery.isError;
  const retry = () => {
    void assignedQuery.refetch();
    void availableQuery.refetch();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="md"
      testID="assign-staff-modal"
      footer={
        selected.length > 0 ? (
          <Button
            title={assignAction.loading ? 'Assigning...' : `Assign ${selected.length} Staff`}
            icon="user-plus"
            fullWidth
            loading={assignAction.loading}
            onPress={() => void assignAction.run()}
            testID="assign-staff-submit"
          />
        ) : undefined
      }
    >
      <View style={{ gap: spacing.lg }}>
        {hint ? (
          <Text variant="callout" color="textSecondary">
            {hint}
          </Text>
        ) : null}

        {loading ? <SkeletonList count={4} /> : null}
        {!loading && failed ? <ErrorState message="Failed to load staff" onRetry={retry} compact /> : null}

        {!loading && !failed ? (
          <>
            {assigned.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="micro" color="textMuted">{`ASSIGNED (${assigned.length})`}</Text>
                {assigned.map((s) => (
                  <ListItem
                    key={s.userId}
                    testID={`assigned-${s.userId}`}
                    left={<Avatar name={s.name} size={40} />}
                    title={s.name}
                    subtitle={subtitleOf(s)}
                    style={{ backgroundColor: colors.successSoft, borderRadius: radii.md }}
                    right={
                      <Button
                        title="Remove"
                        size="sm"
                        variant="ghost"
                        loading={removingId === s.userId}
                        disabled={removeAction.loading}
                        onPress={() => void removeAction.run(s.userId)}
                        testID={`remove-${s.userId}`}
                      />
                    }
                  />
                ))}
              </View>
            ) : null}

            <View style={{ gap: spacing.xs }}>
              <Text variant="micro" color="textMuted">{`AVAILABLE STAFF (${available.length})`}</Text>
              {available.length === 0 ? (
                <Text variant="body" color="textSecondary">
                  All staff are assigned
                </Text>
              ) : (
                available.map((s) => {
                  const warn = warnIds.includes(s.userId);
                  const checked = selected.includes(s.userId);
                  return (
                    <ListItem
                      key={s.userId}
                      testID={`available-${s.userId}`}
                      left={<Avatar name={s.name} size={40} />}
                      title={s.name}
                      subtitle={subtitleOf(s)}
                      onPress={() => toggle(s)}
                      chevron={false}
                      style={warn ? { backgroundColor: colors.warningSoft, borderRadius: radii.md } : undefined}
                      right={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          {warn ? <Icon name="alert" size={18} color="warning" /> : null}
                          <CheckboxMark checked={checked} />
                        </View>
                      }
                    />
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </View>

      <ConfirmDialog
        visible={warnStaff !== null}
        title={warnTitle}
        message={warnStaff && warnMessage ? warnMessage(warnStaff.name) : undefined}
        confirmText="Assign"
        cancelText="Cancel"
        testID="warn-assigned"
        onCancel={() => setWarnStaff(null)}
        onConfirm={() => {
          if (warnStaff) setSelected((prev) => (prev.includes(warnStaff.userId) ? prev : [...prev, warnStaff.userId]));
          setWarnStaff(null);
        }}
      />
    </Modal>
  );
}
