import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';

import { ResponsiveRow, Screen, Section } from '@/components/layout';
import { ConfirmDialog, EmptyState, ErrorState, IconButton, Reveal, LoadingOverlay, SkeletonList, StatCard, useToast } from '@/components/ui';
import { routes } from '@/config/routes';
import { useRefreshOnFocus } from '@/hooks';
import { useAppRouter } from '@/lib/navigation';
import { spacing } from '@/theme';
import type { Branch } from '@/types/api/branches';

import { BranchCard } from '../components/BranchCard';
import { ReassignSheet } from '../components/ReassignSheet';
import { useBranchDeleteFlow } from '../hooks/useBranchDeleteFlow';
import { useBranchList } from '../hooks/useOrgQueries';
import { useOrgScope } from '../hooks/useOrgScope';
import { sortBranches } from '../utils/branchForm';
import { targetBranches } from '../utils/branchDeleteFlow';

/** Route `/admin/branches`: branch list with GPS / radius pills; edit and delete (with staff reassignment). */
export default function BranchListScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const scope = useOrgScope();
  const query = useBranchList(scope.scopeId);
  const flow = useBranchDeleteFlow(scope);
  const { state } = flow;

  useRefreshOnFocus(query.refetch);

  // A refresh that fails while a list is already on screen keeps the list and says so (spec all_Branch: "Failed to load branches").
  const refreshFailed = query.isError && !!query.data;
  useEffect(() => {
    if (refreshFailed) toast.error('Failed to load branches');
  }, [refreshFailed, query.errorUpdatedAt, toast]);

  const branches = useMemo(() => sortBranches(query.data ?? []), [query.data]);
  const addBranch = () => router.push(routes.admin.branches.edit);
  const editBranch = (branch: Branch) => router.push(routes.admin.branches.edit, { branchId: branch.id });

  const confirmBranch = state.step === 'confirm' ? state.branch : null;

  return (
    <Screen
      title="Branch Management"
      subtitle="Locations, GPS and attendance radius"
      refreshing={query.isRefetching && !query.isLoading}
      onRefresh={() => void query.refetch()}
      right={<IconButton icon="plus" variant="filled" accessibilityLabel="Add Branch" onPress={addBranch} testID="branch-add" />}
      testID="branch-list-screen"
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            <StatCard label="Total Branches" value={query.data ? branches.length : '-'} icon="building" tone="primary" caption="Organisation locations" loading={query.isLoading} />
          </ResponsiveRow>
        </Reveal>

        <Reveal index={1}>
        {query.isLoading ? (
          <SkeletonList count={3} />
        ) : query.isError && !query.data ? (
          <ErrorState message="Failed to load branches" onRetry={() => void query.refetch()} />
        ) : branches.length === 0 ? (
          <EmptyState icon="map-pin" title="No branches found" message="Add your first branch to set up attendance locations." action={{ label: 'Add Branch', onPress: addBranch, icon: 'plus' }} />
        ) : (
          <Section title="All Branches">
            <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }}>
              {branches.map((branch) => (
                <BranchCard key={branch.id} branch={branch} onEdit={editBranch} onDelete={(b) => void flow.start(b)} disabled={state.step !== 'idle'} />
              ))}
            </ResponsiveRow>
          </Section>
        )}
        </Reveal>
      </View>

      <LoadingOverlay visible={state.step === 'checking'} message="Checking..." />

      <ConfirmDialog
        visible={confirmBranch !== null}
        title="Delete Branch"
        message={confirmBranch ? `Are you sure you want to delete "${confirmBranch.name}"? This action cannot be undone.` : undefined}
        confirmText="Delete"
        destructive
        loading={state.step === 'confirm' && state.deleting}
        onConfirm={() => void flow.confirmDelete()}
        onCancel={flow.cancel}
        testID="branch-delete-dialog"
      />

      {state.step === 'reassign' ? (
        <ReassignSheet
          state={state}
          targets={targetBranches(branches, state.branch)}
          onClose={flow.cancel}
          onToggleStaff={flow.toggleStaff}
          onToggleAll={flow.toggleAll}
          onSelectTarget={flow.setTarget}
          onSubmit={() => void flow.reassign()}
        />
      ) : null}
    </Screen>
  );
}
