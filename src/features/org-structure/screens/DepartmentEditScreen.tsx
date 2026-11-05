import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { departmentsApi } from '@/api';
import { FormSection, Screen } from '@/components/layout';
import { Button, EmptyState, ErrorState, Icon, Modal, SkeletonList, Text, TextField, useToast } from '@/components/ui';
import { routes } from '@/config/routes';
import { useAsyncAction } from '@/hooks';
import { useAppRouter } from '@/lib/navigation';
import { radii, spacing, useTheme } from '@/theme';

import { useDepartmentList } from '../hooks/useOrgQueries';
import { orgStructureKeys, useOrgScope } from '../hooks/useOrgScope';
import { departmentSavedMessage, validateDepartmentName } from '../utils/departmentForm';

/** How long the "Department Added!" popup stays before the screen closes (v1: 1.5 s). */
const POPUP_MS = 1500;

/** Route `/admin/departments/edit` (param `deptId?`): Add Department, or rename when `deptId` is present. */
export default function DepartmentEditScreen() {
  const params = useLocalSearchParams<{ deptId?: string | string[] }>();
  const deptId = (Array.isArray(params.deptId) ? params.deptId[0] : params.deptId) || undefined;
  const isEdit = !!deptId;
  const router = useAppRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const scope = useOrgScope();
  const queryClient = useQueryClient();
  const list = useDepartmentList(scope.orgId);
  const existing = isEdit ? list.data?.find((d) => d.id === deptId) : undefined;

  const [name, setName] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  const hydrated = useRef(false);
  useEffect(() => {
    if (!isEdit || hydrated.current || !existing) return;
    hydrated.current = true;
    setName(existing.name);
  }, [isEdit, existing]);

  // The popup closes the screen itself; the timer is cleared if the user leaves first (v1 leaked it).
  useEffect(() => {
    if (popup === null) return undefined;
    const timer = setTimeout(() => router.backOr(routes.admin.departments.list), POPUP_MS);
    return () => clearTimeout(timer);
  }, [popup, router]);

  const save = useAsyncAction(
    async () => {
      if (validateDepartmentName(name) !== null) {
        toast.error('Please enter department name');
        return null;
      }
      if (!scope.orgId) {
        toast.error('Please login first');
        return null;
      }
      const trimmed = name.trim();
      if (isEdit && deptId) await departmentsApi.updateDepartment(deptId, { name: trimmed, orgId: scope.orgId });
      else await departmentsApi.addDepartment({ name: trimmed, orgId: scope.orgId });
      return trimmed;
    },
    {
      errorMessage: isEdit ? 'Failed to update department' : 'Failed to add department',
      onSuccess: (saved) => {
        if (saved === null) return;
        for (const key of orgStructureKeys(scope, ['departments', 'home', 'staff'])) {
          void queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
        }
        setPopup(departmentSavedMessage(saved, isEdit));
      },
    },
  );

  const waiting = isEdit && list.isLoading;
  const missing = isEdit && !list.isLoading && !existing && !list.isError;

  return (
    <Screen
      title={isEdit ? 'Edit Department' : 'Add Department'}
      subtitle="Organisation structure"
      footer={
        <Button
          title={save.loading ? (isEdit ? 'Updating...' : 'Saving...') : isEdit ? 'Update Department' : 'Save Department'}
          icon="check"
          fullWidth
          loading={save.loading}
          disabled={save.loading || waiting || missing || popup !== null}
          onPress={() => void save.run()}
          testID="department-submit"
        />
      }
      testID="department-edit-screen"
    >
      {waiting ? (
        <SkeletonList count={1} />
      ) : isEdit && list.isError && !existing ? (
        <ErrorState message="Failed to load department" onRetry={() => void list.refetch()} />
      ) : missing ? (
        <EmptyState icon="briefcase" title="Department not found" message="This department no longer exists." />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 52, height: 52, borderRadius: radii.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={isEdit ? 'edit' : 'briefcase'} size={26} color="primary" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title3">{isEdit ? 'Edit Department' : 'New Department'}</Text>
              <Text variant="callout" color="textSecondary">
                {isEdit ? 'Update the department name below' : 'Enter a name to create a new department'}
              </Text>
            </View>
          </View>
          <FormSection>
            <TextField
              label="Department Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Sales, HR, Engineering"
              leftIcon="briefcase"
              rightIcon={name !== '' ? 'x' : undefined}
              onRightIconPress={() => setName('')}
              rightIconLabel="Clear"
              autoFocus
              editable={!save.loading}
              onSubmitEditing={() => void save.run()}
              returnKeyType="done"
              testID="department-name"
            />
          </FormSection>
        </View>
      )}

      <Modal visible={popup !== null} onClose={() => router.backOr(routes.admin.departments.list)} dismissible={false} size="sm" testID="department-saved">
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ width: 56, height: 56, borderRadius: radii.pill, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={28} color="success" />
          </View>
          <Text variant="title3">{isEdit ? 'Department Updated!' : 'Department Added!'}</Text>
          <Text color="textSecondary" align="center">
            {popup ?? ''}
          </Text>
        </View>
      </Modal>
    </Screen>
  );
}
