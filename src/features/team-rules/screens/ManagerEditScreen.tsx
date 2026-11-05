import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import * as managersApi from '@/api/managers';
import { FormSection, ResponsiveRow, Screen } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingOverlay,
  MultiSelect,
  Select,
  SkeletonList,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { queryKeys } from '@/lib/query/queryKeys';
import { routes, useAppRouter } from '@/lib/navigation';
import { useOrgId } from '@/store/auth';
import { spacing } from '@/theme';

import { ConflictModal } from '../components/ConflictModal';
import { useBranchChoices, useDepartmentChoices, useManagers, usePromotableStaff } from '../hooks/useManagers';
import {
  buildAssignManagerInput,
  countCombinations,
  detectConflicts,
  prefillFromManager,
  validateManagerForm,
  type AssignmentConflict,
} from '../utils/managerAssign';

/** Promote a staff member to manager and set the branch x department scope (route `/admin/managers/edit`, param `userId?`). */
export default function ManagerEditScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const editUserId = typeof params.userId === 'string' && params.userId !== '' ? params.userId : '';
  const isEdit = editUserId !== '';

  const router = useAppRouter();
  const toast = useToast();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const managersQuery = useManagers();
  const branchesQuery = useBranchChoices();
  const deptsQuery = useDepartmentChoices();
  const branches = useMemo(() => branchesQuery.data ?? [], [branchesQuery.data]);
  const departments = useMemo(() => deptsQuery.data ?? [], [deptsQuery.data]);

  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [pickedStaff, setStaffId] = useState('');
  // In edit mode the scope starts from the manager's saved assignments; a draft only exists once the user changes it.
  const [draftBranches, setAssignBranches] = useState<string[] | null>(null);
  const [draftDepts, setAssignDepts] = useState<string[] | null>(null);
  const [conflicts, setConflicts] = useState<AssignmentConflict[] | null>(null);

  const staffQuery = usePromotableStaff(filterBranch, filterDept);
  const editingManager = isEdit ? managersQuery.data?.find((m) => m.userId === editUserId) : undefined;

  // Edit pre-fill once the manager list (and the department list, for a legacy "all departments") are available.
  const prefill = useMemo(
    () =>
      isEdit && managersQuery.isSuccess && !deptsQuery.isLoading
        ? prefillFromManager(editingManager, departments.map((d) => d.id))
        : { branchIds: [] as string[], deptIds: [] as string[] },
    [isEdit, managersQuery.isSuccess, deptsQuery.isLoading, editingManager, departments],
  );
  const staffId = isEdit ? editUserId : pickedStaff;
  const assignBranches = draftBranches ?? prefill.branchIds;
  const assignDepts = draftDepts ?? prefill.deptIds;

  const branchOptions = useMemo(() => [{ label: 'ALL', value: '' }, ...branches.map((b) => ({ label: b.name, value: b.id }))], [branches]);
  const deptOptions = useMemo(() => [{ label: 'ALL', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))], [departments]);
  const staffOptions = useMemo(
    () => (staffQuery.data ?? []).map((s) => ({ label: s.name, value: s.userId, subtitle: s.empId || undefined })),
    [staffQuery.data],
  );
  const branchNames = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b.name])), [branches]);
  const deptNames = useMemo(() => Object.fromEntries(departments.map((d) => [d.id, d.name])), [departments]);

  const combos = countCombinations(assignBranches, assignDepts);

  const submit = useAsyncAction(
    async () => {
      const problem = validateManagerForm({ isEdit, staffId, branchIds: assignBranches, deptIds: assignDepts });
      if (problem) {
        toast.error(problem);
        return false;
      }
      // Always compare against the server's current list, not a possibly stale cache.
      const existing = await queryClient.fetchQuery({
        queryKey: queryKeys.managers.list(orgId),
        queryFn: () => managersApi.listManagers(orgId),
        staleTime: 0,
      });
      if (!isEdit) {
        const already = existing.find((m) => m.userId === staffId);
        if (already) {
          toast.error(`${already.name} is already assigned as a manager`);
          return false;
        }
      }
      const found = detectConflicts({
        managers: existing,
        selfUserId: staffId,
        branchIds: assignBranches,
        deptIds: assignDepts,
        branchNames,
        deptNames,
      });
      if (found.length > 0) {
        setConflicts(found);
        return false;
      }
      const result = await managersApi.assignManager(buildAssignManagerInput(staffId, assignBranches, assignDepts));
      void queryClient.invalidateQueries({ queryKey: queryKeys.managers.all(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff.all(orgId) });
      toast.success(result.message || (isEdit ? 'Manager updated successfully' : 'Manager assigned successfully'));
      router.backOr(routes.admin.managers.list);
      return true;
    },
    { errorMessage: 'Failed to assign manager' },
  );

  const staffName = editingManager?.name ?? '';
  const previewBranches = assignBranches.map((id) => ({ id, name: branchNames[id] ?? id }));
  const previewDepts = assignDepts.map((id) => deptNames[id] ?? id);

  const listsLoading = branchesQuery.isLoading || deptsQuery.isLoading || (isEdit && managersQuery.isLoading);
  const notFound = isEdit && managersQuery.isSuccess && !editingManager;

  return (
    <Screen
      title={isEdit ? 'Edit Manager' : 'Add Manager'}
      footer={
        <Button
          title={isEdit ? 'Update Manager' : 'Assign Manager'}
          icon={isEdit ? 'check' : 'user-plus'}
          fullWidth
          size="lg"
          loading={submit.loading}
          disabled={listsLoading || notFound}
          onPress={() => void submit.run()}
          testID="manager-submit"
        />
      }
      testID="manager-edit-screen"
    >
      {notFound ? (
        <EmptyState icon="user-x" title="Manager not found" message="This manager may have been removed." action={{ label: 'Back to managers', onPress: () => router.backOr(routes.admin.managers.list) }} />
      ) : listsLoading ? (
        <SkeletonList count={4} />
      ) : (
        <View style={{ gap: spacing.xl }}>
          <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }} gap={spacing.lg}>
            <FormSection title="Staff member" description={isEdit ? 'The person cannot be changed when editing.' : 'Filter the list, then pick who becomes a manager.'}>
              {isEdit ? (
                <TextField label="Staff Member" value={staffName || staffId} onChangeText={() => {}} editable={false} rightIcon="lock" testID="manager-staff-locked" />
              ) : (
                <>
                  <Select label="Branch" value={filterBranch} options={branchOptions} onChange={(v) => { setFilterBranch(v); setStaffId(''); }} placeholder="Select Branch" searchable leftIcon="building" testID="filter-branch" />
                  <Select label="Department" value={filterDept} options={deptOptions} onChange={(v) => { setFilterDept(v); setStaffId(''); }} placeholder="Select Department" searchable leftIcon="tag" testID="filter-dept" />
                  <Select
                    label="Staff Member"
                    value={staffId || null}
                    options={staffOptions}
                    onChange={setStaffId}
                    placeholder={staffQuery.isLoading ? 'Loading staff...' : 'Select Staff'}
                    searchable
                    leftIcon="user"
                    required
                    testID="select-staff"
                  />
                </>
              )}
            </FormSection>

            <FormSection title="Assign To" description="A manager needs at least one branch and one department. Pick every department for the whole branch.">
              <MultiSelect
                label="Assign Branch"
                values={assignBranches}
                options={branches.map((b) => ({ label: b.name, value: b.id }))}
                onChange={setAssignBranches}
                placeholder="Select Branches to Assign"
                allSelectedText="All selected"
                selectAll
                searchable
                required
                leftIcon="building"
                testID="assign-branches"
              />
              <MultiSelect
                label="Assign Department"
                values={assignDepts}
                options={departments.map((d) => ({ label: d.name, value: d.id }))}
                onChange={setAssignDepts}
                placeholder="Select Departments to Assign"
                allSelectedText="All selected"
                selectAll
                searchable
                required
                leftIcon="tag"
                testID="assign-depts"
              />
            </FormSection>
          </ResponsiveRow>

          {combos > 0 ? (
            <Card testID="access-preview">
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="title3">Access Preview</Text>
                  <Badge label={`${combos} combinations`} tone="primary" />
                </View>
                {previewBranches.map((b) => (
                  <View key={b.id} style={{ gap: spacing.xs }}>
                    <Text variant="bodyStrong">{b.name}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                      {previewDepts.map((d, i) => (
                        <Badge key={`${d}-${i}`} label={d} tone="neutral" size="sm" />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      )}

      <ConflictModal conflicts={conflicts} onClose={() => setConflicts(null)} />
      <LoadingOverlay visible={submit.loading} message={isEdit ? 'Updating manager...' : 'Assigning manager...'} />
    </Screen>
  );
}
