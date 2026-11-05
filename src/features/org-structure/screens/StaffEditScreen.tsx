import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout';
import { Button, ErrorState, LoadingOverlay, SkeletonList } from '@/components/ui';
import { routes } from '@/config/routes';
import { useAppRouter } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { StaffFormSections } from '../components/StaffFormSections';
import { StaffLimitBanner } from '../components/StaffLimitBanner';
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog';
import { useStaffEditor } from '../hooks/useStaffEditor';

/** Route `/admin/staff/edit` (param `staffId?`): Add Staff, or Edit Staff when `staffId` is present. */
export default function StaffEditScreen() {
  const params = useLocalSearchParams<{ staffId?: string | string[] }>();
  const staffId = Array.isArray(params.staffId) ? params.staffId[0] : params.staffId;
  const router = useAppRouter();
  const session = useSession();
  const editor = useStaffEditor(staffId || undefined);
  const { isEdit, dirty, saving, finish, submit } = editor;
  const [showUnsaved, setShowUnsaved] = useState(false);

  const handleBack = useCallback(() => {
    if (isEdit && dirty) setShowUnsaved(true);
    else finish();
  }, [isEdit, dirty, finish]);

  // Android hardware back: edit mode always goes through the unsaved-changes check.
  useEffect(() => {
    if (!isEdit) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [isEdit, handleBack]);

  const submitLabel = saving ? (isEdit ? 'Updating Staff...' : 'Adding Staff...') : isEdit ? 'Update Staff' : 'Add Staff';
  const blocked = editor.loadingRecord || editor.recordError;

  return (
    <Screen
      title={isEdit ? 'Edit Staff' : 'Add Staff'}
      subtitle={session?.orgName || undefined}
      onBack={handleBack}
      footer={
        <Button
          title={submitLabel}
          icon={isEdit ? 'check' : 'user-plus'}
          fullWidth
          loading={saving}
          disabled={saving || editor.limitReached || blocked}
          onPress={submit}
          testID="staff-submit"
        />
      }
      testID="staff-edit-screen"
    >
      <View style={{ gap: spacing.lg }}>
        {!isEdit && editor.limitInfo ? (
          <StaffLimitBanner info={editor.limitInfo} onUpgrade={() => router.push(routes.admin.billing.overview)} />
        ) : null}

        {editor.recordError ? (
          <ErrorState message="Failed to load staff details" onRetry={editor.retryRecord} />
        ) : editor.loadingRecord ? (
          <SkeletonList count={4} />
        ) : (
          <StaffFormSections
            values={editor.values}
            errors={editor.errors}
            emailRequired={editor.emailRequired}
            setField={editor.setField}
            branches={editor.options.branches}
            departments={editor.options.departments}
            shifts={editor.options.shifts}
            loading={editor.options.loading || editor.suggesting}
            disabled={saving}
            photo={editor.photo}
            onPickPhoto={() => void editor.pickPhoto()}
            onRemovePhoto={editor.removePhoto}
            showMore={editor.showMore}
            onToggleMore={editor.toggleMore}
            onAddShift={() => router.push(routes.admin.shifts)}
          />
        )}
      </View>

      <UnsavedChangesDialog
        visible={showUnsaved}
        onStay={() => setShowUnsaved(false)}
        onExit={() => {
          setShowUnsaved(false);
          finish();
        }}
        onSave={() => {
          setShowUnsaved(false);
          submit();
        }}
      />
      <LoadingOverlay visible={saving} message={isEdit ? 'Updating Staff...' : 'Adding Staff...'} />
    </Screen>
  );
}
