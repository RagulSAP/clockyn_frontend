import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { requestsApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, Text, TextField, useToast } from '@/components/ui';
import { routes, useAppRouter } from '@/lib/navigation';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { RequestCalendarCard } from '../components/RequestCalendarCard';
import { SelectedDateChips } from '../components/DateChips';
import { SuccessModal } from '../components/SuccessModal';
import { useDelayedCall } from '../hooks/useDelayedCall';
import { useMarkRequested, useRequestCalendarMonth } from '../hooks/useRequestData';
import { toggleDate, validateLeave } from '../utils/requestRules';

const SUCCESS_MS = 2000;

/** Leave request: pick one or more dates (any months) on the calendar, give a reason, submit. */
export default function LeaveRequestScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const { isDesktop } = useBreakpoint();
  const session = useSession();
  const orgId = useOrgId();
  const userId = session?.userId ?? '';
  const delayed = useDelayedCall();
  const markRequested = useMarkRequested('leave');
  const cal = useRequestCalendarMonth('leave');

  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [showSuccess, setShowSuccess] = useState(false);

  const submit = useApiMutation((input: Parameters<typeof requestsApi.submitLeave>[0]) => requestsApi.submitLeave(input), {
    invalidate: [queryKeys.requests.all(userId)],
    errorMessage: 'Failed to submit',
  });

  const pick = useCallback((date: string) => setSelected((cur) => toggleDate(cur, date)), []);

  const onSubmit = () => {
    const error = validateLeave({ dates: selected, reason });
    if (error) {
      setReasonError(error === 'Enter a reason for leave' ? error : undefined);
      toast.error(error);
      return;
    }
    setReasonError(undefined);
    if (!session) {
      toast.error('Please login again');
      return;
    }
    const dates = [...selected].sort();
    submit.mutate(
      { userId, orgId, dates, reason: reason.trim() },
      {
        onSuccess: () => {
          markRequested(dates);
          setSelected([]);
          setReason('');
          setShowSuccess(true);
          delayed(() => {
            setShowSuccess(false);
            router.backOr(routes.staff.requests.hub);
          }, SUCCESS_MS);
        },
      },
    );
  };

  const form = (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="title3">{selected.length > 0 ? `${selected.length} ${selected.length === 1 ? 'date' : 'dates'} selected` : 'Select dates'}</Text>
        {selected.length === 0 ? (
          <Text variant="callout" color="textSecondary">
            Tap the days you need off. You can pick dates across months.
          </Text>
        ) : (
          <SelectedDateChips dates={selected} onRemove={(d) => setSelected((cur) => cur.filter((x) => x !== d))} />
        )}
      </View>
      <TextField
        label="Reason"
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          if (reasonError) setReasonError(undefined);
        }}
        placeholder="Reason for leave..."
        multiline
        numberOfLines={4}
        error={reasonError}
        testID="leave-reason"
      />
    </Card>
  );

  return (
    <Screen
      title="Leave Request"
      maxWidth={isDesktop ? 1040 : 720}
      testID="leave-request"
      footer={
        <Button
          title="Submit Leave Request"
          icon="send"
          fullWidth
          loading={submit.isPending}
          disabled={submit.isPending}
          onPress={onSubmit}
          testID="leave-submit"
        />
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: isDesktop ? 1.15 : undefined, alignSelf: 'stretch' }}>
          <RequestCalendarCard
            testID="leave-calendar"
            year={cal.year}
            month={cal.month}
            onMonthChange={cal.setMonth}
            selected={selected}
            onPick={pick}
            statuses={cal.statuses}
            loading={cal.loading}
            unresolved={cal.unresolved}
            loadFailed={cal.error}
            onRetry={() => void cal.refetch()}
          />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{form}</View>
      </View>
      <SuccessModal visible={showSuccess} title="Submitted!" message="Leave request submitted successfully" />
    </Screen>
  );
}
