import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { requestsApi } from '@/api';
import { Screen } from '@/components/layout';
import { Button, Card, Icon, Text, TextField, useToast } from '@/components/ui';
import { routes, useAppRouter } from '@/lib/navigation';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';

import { SuccessModal } from '../components/SuccessModal';
import { useDelayedCall } from '../hooks/useDelayedCall';
import { validateDeviceReason } from '../utils/requestRules';

const SUCCESS_MS = 2000;

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();

/**
 * Device change request. Two modes, one screen:
 *  - pre-login (`/device-change-request?userId&orgId`, opened from the login device-mismatch notice): no session,
 *    no tab bar; on success the user is sent back to the staff login;
 *  - in-app (`/staff/requests/device-change`, no params): ids come from the session; on success go back.
 */
export default function DeviceChangeRequestScreen() {
  const params = useLocalSearchParams<{ userId?: string | string[]; orgId?: string | string[] }>();
  const router = useAppRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const session = useSession();
  const delayed = useDelayedCall();

  const paramUserId = first(params.userId);
  const paramOrgId = first(params.orgId);
  const fromLogin = paramUserId !== '';
  const userId = fromLogin ? paramUserId : (session?.userId ?? '');
  // pre-login: the org of the mismatch; v1 posted '' when it was missing, here fall back to the session / user id
  const orgId = fromLogin ? (paramOrgId || session?.orgId || paramUserId) : (session?.orgId ?? '');

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);

  const submit = useApiMutation((input: Parameters<typeof requestsApi.submitDeviceChange>[0]) => requestsApi.submitDeviceChange(input), {
    invalidate: [queryKeys.requests.all(userId)],
    errorMessage: 'Failed to submit',
  });

  const goBack = () => (fromLogin ? router.backOr(routes.staffLogin) : router.backOr(routes.staff.requests.hub));

  const onSubmit = () => {
    const error = validateDeviceReason(reason);
    if (error) {
      setReasonError(error);
      toast.error(error);
      return;
    }
    setReasonError(undefined);
    if (!userId || !orgId) {
      toast.error('Please login again');
      return;
    }
    submit.mutate(
      { userId, orgId, reason: reason.trim() },
      {
        onSuccess: () => {
          setReason('');
          setShowSuccess(true);
          delayed(() => {
            setShowSuccess(false);
            if (fromLogin) router.replace(routes.staffLogin);
            else router.backOr(routes.staff.requests.hub);
          }, SUCCESS_MS);
        },
      },
    );
  };

  return (
    <Screen
      title="Device Change Request"
      maxWidth={640}
      onBack={goBack}
      testID="device-change-request"
      footer={<Button title="Submit Request" icon="send" fullWidth loading={submit.isPending} disabled={submit.isPending} onPress={onSubmit} testID="device-submit" />}
    >
      <View style={{ gap: spacing.lg }}>
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: radii.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="smartphone" size={30} color="primary" />
          </View>
          <Text variant="title2" align="center">
            Request Device Change
          </Text>
          <Text variant="body" color="textSecondary" align="center" testID="device-description">
            {fromLogin
              ? 'A different device was detected for your account. Submit a request to your admin for approval to use this new device.'
              : 'Submit a request to register a new device for attendance. Your admin will review and approve the change.'}
          </Text>
        </Card>

        {fromLogin ? (
          <View
            testID="device-warning"
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.warningSoft }}
          >
            <Icon name="alert" size={22} color="warning" />
            <Text variant="callout" style={{ flex: 1 }}>
              You are trying to log in from a new device. Your request will be sent to your admin or manager for approval.
            </Text>
          </View>
        ) : null}

        <Card>
          <TextField
            label="Reason for Device Change"
            value={reason}
            onChangeText={(t) => {
              setReason(t);
              if (reasonError) setReasonError(undefined);
            }}
            placeholder="e.g. Lost phone, damaged device, new phone..."
            multiline
            numberOfLines={4}
            error={reasonError}
            testID="device-reason"
          />
        </Card>
      </View>
      <SuccessModal visible={showSuccess} title="Submitted!" message="Device change request submitted successfully" />
    </Screen>
  );
}
