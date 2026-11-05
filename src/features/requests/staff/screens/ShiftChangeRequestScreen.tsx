import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { requestsApi } from '@/api';
import { Screen } from '@/components/layout';
import {
  Button,
  Card,
  DateField,
  EmptyState,
  ErrorState,
  Icon,
  LoadingOverlay,
  Select,
  SkeletonList,
  StatusPill,
  Tabs,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks';
import { formatDate, formatTime12, todayIST } from '@/lib/datetime';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { ShiftChangeRequest } from '@/types/api/requests';

import { SuccessModal } from '../components/SuccessModal';
import { useDelayedCall } from '../hooks/useDelayedCall';
import { useMyRequests, useOrgShifts } from '../hooks/useRequestData';
import { validateShiftChange } from '../utils/requestRules';

const SUCCESS_MS = 1500;
const DASH = '—';

type TabKey = 'new' | 'history';

function HistoryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg }}>
      <Text variant="callout" color="textSecondary">
        {label}
      </Text>
      <Text variant="callout" weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** Shift change: "New Request" form and "My Requests" history (success switches to history). */
export default function ShiftChangeRequestScreen() {
  const toast = useToast();
  const session = useSession();
  const orgId = useOrgId();
  const userId = session?.userId ?? '';
  const delayed = useDelayedCall();
  const shiftsQuery = useOrgShifts();
  const requestsQuery = useMyRequests();

  const [tab, setTab] = useState<TabKey>('new');
  const [reason, setReason] = useState('');
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [errors, setErrors] = useState<{ reason?: string; shift?: string; date?: string }>({});
  const [showSuccess, setShowSuccess] = useState(false);

  // The history reloads every time the screen is focused again.
  useRefreshOnFocus(requestsQuery.refetch);

  const options = useMemo(
    () => (shiftsQuery.data ?? []).map((s) => ({ label: `${s.name}  (${formatTime12(s.startTime)} – ${formatTime12(s.endTime)})`, value: s.id })),
    [shiftsQuery.data],
  );
  const history = useMemo(
    () => (requestsQuery.data ?? []).filter((r): r is ShiftChangeRequest => r.type === 'shift_change'),
    [requestsQuery.data],
  );

  const submit = useApiMutation((input: Parameters<typeof requestsApi.submitShiftChange>[0]) => requestsApi.submitShiftChange(input), {
    invalidate: [queryKeys.requests.all(userId)],
    errorMessage: 'Failed to submit',
  });

  const onSubmit = () => {
    const message = validateShiftChange({ reason, shiftId, date });
    if (message) {
      setErrors({
        reason: message === 'Please enter a reason' ? message : undefined,
        shift: message === 'Please select a preferred shift' ? message : undefined,
        date: message === 'Please select a requested shift date' ? message : undefined,
      });
      toast.error(message);
      return;
    }
    setErrors({});
    if (!session || shiftId === null) {
      toast.error('Please login again');
      return;
    }
    submit.mutate(
      { userId, orgId, reason: reason.trim(), requestedShiftId: shiftId, date },
      {
        onSuccess: () => {
          setReason('');
          setShiftId(null);
          setDate('');
          setShowSuccess(true);
          delayed(() => {
            setShowSuccess(false);
            setTab('history');
          }, SUCCESS_MS);
        },
      },
    );
  };

  const newTab = (
    <View style={{ gap: spacing.lg }}>
      <Card variant="muted" style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <Icon name="arrow-up-down" size={24} color="primary" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Request a Shift Change</Text>
          <Text variant="callout" color="textSecondary">
            Fill in the details below. Your manager will review and respond.
          </Text>
        </View>
      </Card>
      <Card style={{ gap: spacing.lg }}>
        <TextField
          label="Reason"
          value={reason}
          onChangeText={(t) => {
            setReason(t);
            if (errors.reason) setErrors((e) => ({ ...e, reason: undefined }));
          }}
          placeholder="Describe your reason for requesting a shift change..."
          multiline
          numberOfLines={4}
          error={errors.reason}
          testID="shift-reason"
        />
        <Select<number>
          label="Preferred Shift"
          title="Select Preferred Shift"
          value={shiftId}
          options={options}
          onChange={(v) => {
            setShiftId(v);
            setErrors((e) => ({ ...e, shift: undefined }));
          }}
          placeholder={options.length === 0 ? 'No shifts available' : 'Select preferred shift...'}
          disabled={options.length === 0}
          error={errors.shift}
          leftIcon="clock"
          testID="shift-select"
        />
        <DateField
          label="Requested Shift Date"
          value={date}
          onChange={(v) => {
            setDate(v);
            setErrors((e) => ({ ...e, date: undefined }));
          }}
          minDate={todayIST()}
          placeholder="Select date..."
          error={errors.date}
          testID="shift-date"
        />
      </Card>
    </View>
  );

  const historyTab = requestsQuery.isPending ? (
    <View accessibilityLabel="Loading requests...">
      <SkeletonList count={3} />
    </View>
  ) : requestsQuery.isError && history.length === 0 ? (
    <ErrorState message="Could not load your shift change requests." onRetry={() => void requestsQuery.refetch()} />
  ) : history.length === 0 ? (
    <EmptyState icon="file-text" title="No shift change requests yet" />
  ) : (
    <View style={{ gap: spacing.md }}>
      {history.map((r) => (
        <Card key={r.id} testID={`shift-history-${r.id}`} style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusPill status={r.status} />
            {r.createdAt ? (
              <Text variant="caption" color="textMuted">
                {formatDate(r.createdAt)}
              </Text>
            ) : null}
          </View>
          <HistoryRow label="Requested Shift" value={r.requestedShiftTiming || DASH} />
          <HistoryRow label="Shift Date" value={r.shiftChangeDate ? formatDate(r.shiftChangeDate) : DASH} />
          <HistoryRow label="Reason" value={r.reason || DASH} />
        </Card>
      ))}
    </View>
  );

  return (
    <Screen
      title="Shift Change Request"
      maxWidth={720}
      testID="shift-change-request"
      refreshing={tab === 'history' && requestsQuery.isRefetching}
      onRefresh={tab === 'history' ? () => void requestsQuery.refetch() : undefined}
      footer={
        tab === 'new' ? (
          <Button title="Submit Request" icon="send" fullWidth loading={submit.isPending} disabled={submit.isPending} onPress={onSubmit} testID="shift-submit" />
        ) : undefined
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Tabs
          tabs={[
            { key: 'new', label: 'New Request' },
            { key: 'history', label: 'My Requests' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as TabKey)}
          testID="shift-tabs"
        />
        {tab === 'new' ? newTab : historyTab}
      </View>
      <LoadingOverlay visible={submit.isPending} message="Submitting..." />
      <SuccessModal visible={showSuccess} title="Submitted!" message="Shift change request submitted successfully" />
    </Screen>
  );
}
