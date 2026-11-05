import React, { useState } from 'react';
import { View } from 'react-native';

import { requestsApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, Text, TextField, useToast } from '@/components/ui';
import { formatDate, minutesNowIST, todayIST } from '@/lib/datetime';
import { routes, useAppRouter } from '@/lib/navigation';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { DateChip } from '../components/DateChips';
import { RequestCalendarCard } from '../components/RequestCalendarCard';
import { SuccessModal } from '../components/SuccessModal';
import { SlotButton, TimeSlotSheet } from '../components/TimeSlotSheet';
import { useDelayedCall } from '../hooks/useDelayedCall';
import { useMarkRequested, useRequestCalendarMonth } from '../hooks/useRequestData';
import { endSlots, slotLabel, startSlots, validatePermission, type TimeSlot } from '../utils/requestRules';

const SUCCESS_MS = 2000;

type Picking = { kind: 'start' | 'end'; slots: TimeSlot[] } | null;

/** Permission request: one date, a start and end time (at most 6 h apart) and a reason. */
export default function PermissionRequestScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const { isDesktop } = useBreakpoint();
  const session = useSession();
  const orgId = useOrgId();
  const userId = session?.userId ?? '';
  const delayed = useDelayedCall();
  const markRequested = useMarkRequested('permission');
  const cal = useRequestCalendarMonth('permission');

  const [date, setDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [picking, setPicking] = useState<Picking>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const submit = useApiMutation((input: Parameters<typeof requestsApi.submitPermission>[0]) => requestsApi.submitPermission(input), {
    invalidate: [queryKeys.requests.all(userId)],
    errorMessage: 'Failed to submit',
  });

  const openStart = () => setPicking({ kind: 'start', slots: startSlots(date, todayIST(), Math.floor(minutesNowIST())) });
  const openEnd = () => {
    if (!startTime) {
      toast.error('Select start time first');
      return;
    }
    setPicking({ kind: 'end', slots: endSlots(startTime) });
  };

  const choose = (value: string) => {
    if (picking?.kind === 'start') {
      setStartTime(value);
      setEndTime(''); // the end window depends on the start
    } else {
      setEndTime(value);
    }
    setPicking(null);
  };

  const onSubmit = () => {
    const error = validatePermission({ date, startTime, endTime, reason, today: todayIST(), nowMinutes: Math.floor(minutesNowIST()) });
    if (error) {
      setReasonError(error === 'Enter a reason' ? error : undefined);
      toast.error(error);
      return;
    }
    setReasonError(undefined);
    if (!session || !date) {
      toast.error('Please login again');
      return;
    }
    submit.mutate(
      { userId, orgId, date, startTime, endTime, reason: reason.trim() },
      {
        onSuccess: () => {
          markRequested([date]);
          setDate(null);
          setStartTime('');
          setEndTime('');
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
        <Text variant="title3">{date ? 'Selected date' : 'Select a date'}</Text>
        {date ? (
          <View style={{ flexDirection: 'row' }}>
            <DateChip testID="permission-date-chip" icon="calendar" label={formatDate(date, 'EEE, dd MMM yyyy')} onRemove={() => setDate(null)} />
          </View>
        ) : (
          <Text variant="callout" color="textSecondary">
            Pick one day on the calendar. Permission can be at most 6 hours.
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <SlotButton label="Start Time" value={slotLabel(startTime)} onPress={openStart} testID="permission-start" />
        <SlotButton label="End Time" value={slotLabel(endTime)} onPress={openEnd} testID="permission-end" />
      </View>
      <TextField
        label="Reason"
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          if (reasonError) setReasonError(undefined);
        }}
        placeholder="Reason for permission..."
        multiline
        numberOfLines={4}
        error={reasonError}
        testID="permission-reason"
      />
    </Card>
  );

  return (
    <Screen
      title="Permission Request"
      maxWidth={isDesktop ? 1040 : 720}
      testID="permission-request"
      footer={
        <Button
          title="Submit Permission Request"
          icon="send"
          fullWidth
          loading={submit.isPending}
          disabled={submit.isPending}
          onPress={onSubmit}
          testID="permission-submit"
        />
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: isDesktop ? 1.15 : undefined, alignSelf: 'stretch' }}>
          <RequestCalendarCard
            testID="permission-calendar"
            year={cal.year}
            month={cal.month}
            onMonthChange={cal.setMonth}
            selected={date ? [date] : []}
            onPick={setDate}
            statuses={cal.statuses}
            loading={cal.loading}
            unresolved={cal.unresolved}
            loadFailed={cal.error}
            onRetry={() => void cal.refetch()}
          />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{form}</View>
      </View>
      <TimeSlotSheet
        visible={picking !== null}
        title={picking?.kind === 'end' ? 'End Time' : 'Start Time'}
        slots={picking?.slots ?? []}
        value={picking?.kind === 'end' ? endTime : startTime}
        emptyMessage={picking?.kind === 'end' ? 'No end times available within 6 hours of the selected start time.' : 'No future start times available for today.'}
        onSelect={choose}
        onClose={() => setPicking(null)}
      />
      <SuccessModal visible={showSuccess} title="Submitted!" message="Permission request submitted successfully" />
    </Screen>
  );
}
