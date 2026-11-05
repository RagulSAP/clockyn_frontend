import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  ListItem,
  Modal,
  SkeletonList,
  Switch,
  Text,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';
import type { Manager, ManagedStaff, ManagerPermissions } from '@/types/api/managers';

import {
  allEnabled,
  countEnabled,
  mergePermissions,
  permissionIcon,
  permissionProgress,
  toggleAll,
  togglePermission,
} from '../utils/permissions';
import { groupAssignmentsByBranch, pluralLabel } from '../utils/managerAssign';

// ─── branches popup ─────────────────────────────────────────────────────────────────────────

export function BranchAssignmentsModal({ manager, onClose }: { manager: Manager | null; onClose: () => void }) {
  const groups = manager ? groupAssignmentsByBranch(manager.assignments) : [];
  const count = manager?.assignments.length ?? 0;
  return (
    <Modal
      visible={!!manager}
      onClose={onClose}
      title={manager ? `${manager.name}'s Branches` : undefined}
      footer={<Button title="Close" variant="secondary" fullWidth onPress={onClose} />}
      testID="branches-modal"
    >
      {manager ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="callout" color="textSecondary">
            {pluralLabel(count, 'assignment', 'assignments')}
          </Text>
          {groups.length === 0 ? (
            <EmptyState icon="building" title="No branches assigned" compact />
          ) : (
            groups.map((g) => (
              <Card key={g.key} variant="muted" padding={spacing.md}>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Icon name="building" size={16} color="primary" />
                    <Text variant="bodyStrong">{g.branchLabel}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {g.departments.map((d, i) => (
                      <Badge key={`${d}-${i}`} label={d} tone="neutral" size="sm" />
                    ))}
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      ) : null}
    </Modal>
  );
}

// ─── staff under a manager ──────────────────────────────────────────────────────────────────

export type ManagerStaffSheetProps = {
  manager: Manager | null;
  staff: ManagedStaff[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
};

export function ManagerStaffSheet({ manager, staff, loading, error, onRetry, onClose }: ManagerStaffSheetProps) {
  const list = staff ?? [];
  return (
    <BottomSheet
      visible={!!manager}
      onClose={onClose}
      title={manager ? `${manager.name}'s Staff` : undefined}
      snap="half"
      testID="manager-staff-sheet"
    >
      {manager ? (
        <View style={{ gap: spacing.md }}>
          {!loading && !error ? (
            <Text variant="callout" color="textSecondary">
              {pluralLabel(list.length, 'staff member', 'staff members')}
            </Text>
          ) : null}
          {loading ? (
            <SkeletonList count={4} />
          ) : error ? (
            <ErrorState message={getErrorMessage(error, 'Failed to load staff')} onRetry={onRetry} compact />
          ) : list.length === 0 ? (
            <EmptyState icon="users" title="No staff found" compact />
          ) : (
            <Card padding={0} variant="outlined">
              {list.map((s, i) => (
                <ListItem
                  key={s.userId}
                  left={<Avatar name={s.name} size={40} />}
                  title={s.name}
                  subtitle={s.empId}
                  right={
                    <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                      {s.branch ? <Badge label={s.branch} tone="primary" size="sm" /> : null}
                      {s.department ? <Badge label={s.department} tone="neutral" size="sm" /> : null}
                    </View>
                  }
                  divider={i < list.length - 1}
                />
              ))}
            </Card>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

// ─── permissions editor ─────────────────────────────────────────────────────────────────────

export type PermissionsSheetProps = {
  manager: Manager | null;
  /** Server permission map; `undefined` while loading or after a failed load. */
  serverPermissions: ManagerPermissions | undefined;
  loading: boolean;
  error: unknown;
  saving: boolean;
  onRetry: () => void;
  onSave: (permissions: ManagerPermissions) => void;
  onClose: () => void;
};

/**
 * Permission toggles. The catalogue lives on the client and is merged with the server map; when the server map cannot
 * be loaded the sheet shows an error instead of all-off toggles, so saving can never overwrite real permissions with
 * an all-false default (v1 defect).
 */
export function PermissionsSheet(props: PermissionsSheetProps) {
  // Keyed by manager: edits never leak from one manager to the next.
  return <PermissionsSheetBody key={props.manager?.userId ?? 'none'} {...props} />;
}

function PermissionsSheetBody({ manager, serverPermissions, loading, error, saving, onRetry, onSave, onClose }: PermissionsSheetProps) {
  const { colors } = useTheme();
  const loaded = !!serverPermissions;
  // Server values merged with the catalogue, overlaid with the user's unsaved edits.
  const serverMerged = useMemo(() => (serverPermissions ? mergePermissions(serverPermissions) : {}), [serverPermissions]);
  const [edits, setEdits] = useState<ManagerPermissions | null>(null);
  const perms = edits ?? serverMerged;
  const setPerms = (fn: (p: ManagerPermissions) => ManagerPermissions) => setEdits(fn(perms));

  const names = Object.keys(perms);
  const enabled = countEnabled(perms);
  const everything = allEnabled(perms);
  const progress = permissionProgress(perms);

  return (
    <BottomSheet
      visible={!!manager}
      onClose={onClose}
      title={manager?.name}
      snap="tall"
      dismissible={!saving}
      testID="permissions-sheet"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button
            title="Save Permissions"
            onPress={() => onSave(perms)}
            loading={saving}
            disabled={!loaded || loading}
            style={{ flex: 1 }}
            testID="permissions-save"
          />
        </View>
      }
    >
      {loading ? (
        <SkeletonList count={5} />
      ) : error || !loaded ? (
        <ErrorState message={getErrorMessage(error, 'Failed to load permissions')} onRetry={onRetry} compact />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text variant="callout" color="textSecondary" testID="permissions-count">
            {`${enabled}/${names.length} permissions active`}
          </Text>
          <View style={{ height: 6, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${progress}%`, backgroundColor: colors.primary, borderRadius: radii.pill }} />
          </View>
          <Card padding={0} variant="outlined">
            <ListItem
              icon={everything ? 'check-circle' : 'circle'}
              iconTone="primary"
              title={everything ? 'Deselect All' : 'Select All'}
              onPress={() => setPerms((p) => toggleAll(p))}
              divider
              chevron={false}
              testID="permissions-toggle-all"
            />
            {names.map((name, i) => (
              <ListItem
                key={name}
                icon={permissionIcon(name)}
                title={name}
                right={<Switch value={!!perms[name]} onValueChange={() => setPerms((p) => togglePermission(p, name))} accessibilityLabel={name} />}
                onPress={() => setPerms((p) => togglePermission(p, name))}
                chevron={false}
                divider={i < names.length - 1}
              />
            ))}
          </Card>
        </View>
      )}
    </BottomSheet>
  );
}
