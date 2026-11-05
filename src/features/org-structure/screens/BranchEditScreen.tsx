import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { FormSection, ResponsiveRow, Screen } from '@/components/layout';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingOverlay, SkeletonList, Spinner, Text, TextField } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import { useSession } from '@/store/auth';

import { LocationPickerModal } from '../components/LocationPickerModal';
import { RadiusSelector } from '../components/RadiusSelector';
import { useBranchEditor } from '../hooks/useBranchEditor';
import { formatGps } from '../utils/branchForm';

/** Route `/admin/branches/edit` (param `branchId?`): Add Branch, or Edit Branch when `branchId` is present. */
export default function BranchEditScreen() {
  const params = useLocalSearchParams<{ branchId?: string | string[] }>();
  const branchId = (Array.isArray(params.branchId) ? params.branchId[0] : params.branchId) || undefined;
  const session = useSession();
  const { colors } = useTheme();
  const editor = useBranchEditor(branchId);
  const { isEdit, values, errors, saving } = editor;
  const busy = saving || editor.locating;

  const submitLabel = saving ? (isEdit ? 'Updating...' : 'Saving...') : isEdit ? 'Update Branch' : 'Save Branch';

  return (
    <Screen
      title={isEdit ? 'Edit Branch' : 'Add Branch'}
      subtitle={session?.orgName || undefined}
      footer={
        <Button
          title={submitLabel}
          icon="check"
          fullWidth
          loading={saving}
          disabled={saving || editor.loading || editor.notFound || editor.loadError}
          onPress={editor.submit}
          testID="branch-submit"
        />
      }
      testID="branch-edit-screen"
    >
      {editor.loading ? (
        <SkeletonList count={3} />
      ) : editor.loadError ? (
        <ErrorState message="Failed to load branch" onRetry={editor.retry} />
      ) : editor.notFound ? (
        <EmptyState icon="map-pin" title="Branch not found" message="This branch no longer exists." />
      ) : (
        <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }} gap={spacing.lg}>
          <FormSection title="Branch details">
            <TextField
              label="Branch Name"
              required
              value={values.name}
              onChangeText={editor.setName}
              placeholder="Enter branch name"
              leftIcon="building"
              error={errors.name}
              editable={!busy}
              testID="branch-name"
            />
            <TextField
              label="Branch Address"
              required
              value={values.address}
              onChangeText={editor.setAddress}
              placeholder="Enter branch address"
              leftIcon="map-pin"
              multiline
              numberOfLines={3}
              error={errors.address}
              editable={!busy}
              testID="branch-address"
            />
          </FormSection>

          <FormSection title="Location & radius">
            <View style={{ gap: spacing.xs }}>
              <Text variant="callout" weight="semibold" color="textSecondary">
                GPS Location *
              </Text>
              <Card
                variant="outlined"
                padding={spacing.lg}
                onPress={editor.openPicker}
                disabled={busy}
                accessibilityLabel="GPS Location"
                testID="branch-gps"
                style={{
                  borderColor: errors.gps ? colors.danger : editor.gpsSet ? colors.success : colors.border,
                  backgroundColor: editor.gpsSet ? colors.successSoft : colors.surface,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  {editor.locating ? (
                    <>
                      <Spinner size="small" />
                      <Text color="textSecondary">Getting location...</Text>
                    </>
                  ) : editor.gpsSet ? (
                    <>
                      <Icon name="check-circle" size={20} color="success" />
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {formatGps(values.latitude, values.longitude, 6)}
                      </Text>
                      <Text variant="callout" color="primary">
                        Change
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon name="locate" size={20} color="primary" />
                      <Text color="textMuted">Tap to locate GPS</Text>
                    </>
                  )}
                </View>
              </Card>
              {errors.gps ? (
                <Text variant="caption" color="danger">
                  {errors.gps}
                </Text>
              ) : null}
            </View>

            <Card variant="muted" padding={spacing.md}>
              <RadiusSelector value={values.radius} onChange={editor.setRadius} />
            </Card>
          </FormSection>
        </ResponsiveRow>
      )}

      <LocationPickerModal
        visible={editor.pickerOpen}
        onClose={editor.closePicker}
        startPin={editor.startPin}
        radius={values.radius}
        confirmLabel={editor.gpsSet ? 'Update Location' : 'Save Location'}
        onConfirm={editor.confirmLocation}
      />
      <LoadingOverlay visible={saving} message={isEdit ? 'Updating Branch...' : 'Adding Branch...'} />
    </Screen>
  );
}
