import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen, ResponsiveRow } from '@/components/layout';
import { EmptyState, ErrorState, IconButton, LoadingOverlay, Reveal, SkeletonList, StatCard, useConfirm } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { routes, useAppRouter } from '@/lib/navigation';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import * as managersApi from '@/api/managers';
import type { ManagerPermissions } from '@/types/api/managers';

import { ManagerCard } from '../components/ManagerCard';
import { BranchAssignmentsModal, ManagerStaffSheet, PermissionsSheet } from '../components/ManagerSheets';
import { useManagerPermissionMap, useManagers, useStaffUnderManager } from '../hooks/useManagers';
import { managerStats } from '../utils/managerAssign';

/** Managers of the company: assignments, staff under each manager, permission editor, remove (route `/admin/managers`). */
export default function ManagerListScreen() {
  const router = useAppRouter();
  const orgId = useOrgId();
  const session = useSession();
  const confirm = useConfirm();

  const managersQuery = useManagers();
  const managers = useMemo(() => managersQuery.data ?? [], [managersQuery.data]);
  const stats = managerStats(managers);

  const [branchesId, setBranchesId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [permsId, setPermsId] = useState<string | null>(null);

  const branchesManager = managers.find((m) => m.userId === branchesId) ?? null;
  const staffManager = managers.find((m) => m.userId === staffId) ?? null;
  const permsManager = managers.find((m) => m.userId === permsId) ?? null;

  const staffQuery = useStaffUnderManager(staffId);
  const permsQuery = useManagerPermissionMap(permsId);

  const removeMutation = useApiMutation((userId: string) => managersApi.removeManager(userId), {
    invalidate: [queryKeys.managers.all(orgId), queryKeys.staff.all(orgId)],
    successMessage: 'Manager Removed!',
    errorMessage: 'Failed to remove manager',
  });

  const saveMutation = useApiMutation(
    (v: { userId: string; permissions: ManagerPermissions }) => managersApi.saveManagerPermissions(v.userId, v.permissions),
    {
      invalidate: (_d, v) => [queryKeys.managers.permissions(orgId, v.userId)],
      successMessage: 'Permissions Saved!',
      errorMessage: 'Failed to save permissions',
      onSuccess: () => setPermsId(null),
    },
  );

  const onRemove = async (userId: string, name: string) => {
    const ok = await confirm({ title: 'Remove Manager', message: `Remove ${name} as manager?`, confirmText: 'Remove', destructive: true });
    if (!ok) return;
    try {
      await removeMutation.mutateAsync(userId);
    } catch {
      // The mutation already showed the server message.
    }
  };

  const onSavePermissions = async (permissions: ManagerPermissions) => {
    if (!permsManager) return;
    try {
      await saveMutation.mutateAsync({ userId: permsManager.userId, permissions });
    } catch {
      // The sheet stays open; the mutation already showed the server message.
    }
  };

  const loadingFirst = managersQuery.isLoading;
  const refreshing = managersQuery.isRefetching && !managersQuery.isLoading;

  return (
    <Screen
      title="Manager Settings"
      subtitle={session?.orgName || undefined}
      refreshing={refreshing}
      onRefresh={() => void managersQuery.refetch()}
      right={<IconButton icon="plus" variant="filled" accessibilityLabel="Add manager" onPress={() => router.push(routes.admin.managers.edit)} testID="add-manager" />}
      testID="manager-list-screen"
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <ResponsiveRow columns={3} gap={spacing.md}>
            <StatCard label="Total" value={stats.total} icon="users" tone="primary" loading={loadingFirst} />
            <StatCard label="Assigned" value={stats.assigned} icon="user-check" tone="success" loading={loadingFirst} />
            <StatCard label="Assignments" value={stats.assignments} icon="building" tone="primary" loading={loadingFirst} />
          </ResponsiveRow>
        </Reveal>

        <Reveal index={1}>
        {loadingFirst ? (
          <SkeletonList count={4} />
        ) : managersQuery.isError && !managersQuery.data ? (
          <ErrorState message={getErrorMessage(managersQuery.error, 'Failed to load managers')} onRetry={() => void managersQuery.refetch()} />
        ) : managers.length === 0 ? (
          <EmptyState
            icon="user-plus"
            title="No managers yet"
            message="Tap + to assign your first manager"
            action={{ label: 'Assign Manager', icon: 'plus', onPress: () => router.push(routes.admin.managers.edit) }}
          />
        ) : (
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.md}>
            {managers.map((m, i) => (
              <ManagerCard
                key={m.userId}
                manager={m}
                index={i}
                onViewBranches={() => setBranchesId(m.userId)}
                onViewStaff={() => setStaffId(m.userId)}
                onPermissions={() => setPermsId(m.userId)}
                onEdit={() => router.push(routes.admin.managers.edit, { userId: m.userId })}
                onRemove={() => void onRemove(m.userId, m.name)}
              />
            ))}
          </ResponsiveRow>
        )}
        </Reveal>
      </View>

      <BranchAssignmentsModal manager={branchesManager} onClose={() => setBranchesId(null)} />
      <ManagerStaffSheet
        manager={staffManager}
        staff={staffQuery.data}
        loading={staffQuery.isLoading}
        error={staffQuery.error}
        onRetry={() => void staffQuery.refetch()}
        onClose={() => setStaffId(null)}
      />
      <PermissionsSheet
        manager={permsManager}
        serverPermissions={permsQuery.data}
        loading={permsQuery.isLoading}
        error={permsQuery.error}
        saving={saveMutation.isPending}
        onRetry={() => void permsQuery.refetch()}
        onSave={(p) => void onSavePermissions(p)}
        onClose={() => setPermsId(null)}
      />
      <LoadingOverlay visible={removeMutation.isPending} message="Removing..." />
    </Screen>
  );
}
