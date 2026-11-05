import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { departmentsApi } from '@/api';
import { ResponsiveRow, Screen, Section } from '@/components/layout';
import { Card, ConfirmDialog, EmptyState, ErrorState, Icon, IconButton, Reveal, SkeletonList, StatCard, Text } from '@/components/ui';
import { routes } from '@/config/routes';
import { useAsyncAction, useRefreshOnFocus } from '@/hooks';
import { useAppRouter } from '@/lib/navigation';
import { radii, spacing, useTheme } from '@/theme';
import type { Department } from '@/types/api/departments';

import { useDepartmentList } from '../hooks/useOrgQueries';
import { orgStructureKeys, useOrgScope } from '../hooks/useOrgScope';
import { sortDepartments } from '../utils/departmentForm';

/** Route `/admin/departments`: department list with rename and delete. */
export default function DepartmentListScreen() {
  const router = useAppRouter();
  const { colors } = useTheme();
  const scope = useOrgScope();
  const queryClient = useQueryClient();
  const query = useDepartmentList(scope.orgId);
  const [toDelete, setToDelete] = useState<Department | null>(null);

  useRefreshOnFocus(query.refetch);

  const departments = useMemo(() => sortDepartments(query.data ?? []), [query.data]);
  const add = () => router.push(routes.admin.departments.edit);

  const remove = useAsyncAction(
    async (dept: Department) => {
      await departmentsApi.deleteDepartment(dept.id, scope.orgId);
      return dept;
    },
    {
      errorMessage: 'Failed to delete department',
      successMessage: (dept) => `"${dept.name}" deleted successfully`,
      onSuccess: () => {
        setToDelete(null);
        for (const key of orgStructureKeys(scope, ['departments', 'home', 'staff'])) {
          void queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
        }
      },
      // Re-sync the list with the server after a failed delete (the row may already be gone).
      onError: () => {
        setToDelete(null);
        void query.refetch();
      },
    },
  );

  const confirmDelete = useCallback(() => {
    if (toDelete) void remove.run(toDelete);
  }, [toDelete, remove]);

  return (
    <Screen
      title="Department Management"
      subtitle="Organisation structure"
      refreshing={query.isRefetching && !query.isLoading}
      onRefresh={() => void query.refetch()}
      right={<IconButton icon="plus" variant="filled" accessibilityLabel="Add Department" onPress={add} testID="department-add" />}
      testID="department-list-screen"
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            <StatCard label="Total Departments" value={query.data ? departments.length : '-'} icon="briefcase" tone="primary" caption="Organisation structure" loading={query.isLoading} />
          </ResponsiveRow>
        </Reveal>

        <Reveal index={1}>
        {query.isLoading ? (
          <SkeletonList count={3} />
        ) : query.isError && !query.data ? (
          <ErrorState message="Failed to load departments" onRetry={() => void query.refetch()} />
        ) : departments.length === 0 ? (
          <EmptyState
            icon="users"
            title="No Departments Yet"
            message="Add your first department to organise your staff."
            action={{ label: 'Add Department', onPress: add, icon: 'plus' }}
          />
        ) : (
          <Section title="All Departments">
            <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
              {departments.map((dept) => (
                <Card key={dept.id} padding={spacing.lg} testID={`department-card-${dept.id}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="briefcase" size={22} color="primary" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {dept.name}
                      </Text>
                      <Text variant="callout" color="textSecondary">
                        Department
                      </Text>
                    </View>
                    <IconButton
                      icon="edit"
                      variant="tonal"
                      accessibilityLabel={`Edit ${dept.name}`}
                      onPress={() => router.push(routes.admin.departments.edit, { deptId: dept.id })}
                    />
                    <IconButton icon="trash" variant="tonal" accessibilityLabel={`Delete ${dept.name}`} onPress={() => setToDelete(dept)} />
                  </View>
                </Card>
              ))}
            </ResponsiveRow>
          </Section>
        )}
        </Reveal>
      </View>

      <ConfirmDialog
        visible={toDelete !== null}
        title="Delete Department"
        message={toDelete ? `Are you sure you want to delete "${toDelete.name}"?` : undefined}
        confirmText="Delete"
        destructive
        loading={remove.loading}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
        testID="department-delete-dialog"
      />
    </Screen>
  );
}
