import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Badge, EmptyState, ErrorState, LoadingOverlay, SectionHeader, SkeletonList, StatusPill, Text, type IconName } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { getErrorMessage } from '@/lib/api/errors';
import { useOrgId, useSession } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import type { RequestType, StaffRequest } from '@/types/api/requests';

import { useRequestList } from '../hooks/useAdminRequests';
import { useDecideRequest } from '../hooks/useDecideRequest';
import {
  EMPTY_VALUE,
  dateStatus,
  displayDate,
  formatDatesLine,
  formatPermissionRange,
  groupPermissionsByDate,
  overallStatus,
  sortNewestFirst,
} from '../utils/requestLogic';
import { ApprovalCard, InfoRow } from './ApprovalCard';

type TypeConfig = { title: string; empty: string; emptyIcon: IconName };

const CONFIG: Record<RequestType, TypeConfig> = {
  leave: { title: 'Leave Requests', empty: 'No leave requests found', emptyIcon: 'calendar-x' },
  permission: { title: 'Permission Requests', empty: 'No permission requests found', emptyIcon: 'clock' },
  shift_change: { title: 'Shift Change Requests', empty: 'No shift change requests found', emptyIcon: 'refresh' },
  device_change: { title: 'Device Change Requests', empty: 'No device change requests found', emptyIcon: 'smartphone' },
};

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Leave: requested dates strip + per-date statuses (read only; decisions apply to every date of the request). */
function LeaveTop({ request }: { request: StaffRequest }) {
  const { colors } = useTheme();
  const multi = request.dates.length > 1 && Object.keys(request.dateStatuses).length > 0;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" color={colors.primary} weight="semibold" style={{ flex: 1 }}>
          {formatDatesLine(request.dates)}
        </Text>
      </View>
      {multi ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {[...request.dates].sort().map((d) => (
            <StatusPill key={d} status={dateStatus(request, d)} label={`${displayDate(d).slice(0, 6)} · ${dateStatus(request, d)}`} size="sm" />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CardBody({ request, date }: { request: StaffRequest; date?: string }) {
  switch (request.type) {
    case 'leave':
      return <InfoRow icon="message-square" label="Reason" value={request.reason || 'No reason provided'} />;
    case 'permission':
      return (
        <>
          <InfoRow icon="calendar" label="Req. Date" value={displayDate(date)} emphasis />
          <InfoRow icon="clock" label="Time" value={formatPermissionRange(request.startTime, request.endTime)} />
          <InfoRow icon="message-square" label="Reason" value={request.reason || EMPTY_VALUE} />
        </>
      );
    case 'shift_change':
      return (
        <>
          <InfoRow icon="clock" label="Current Shift" value={request.currentShiftTiming || EMPTY_VALUE} />
          <InfoRow icon="refresh" label="Requested Shift" value={request.requestedShiftTiming || EMPTY_VALUE} emphasis />
          <InfoRow icon="calendar" label="Shift Date" value={request.shiftChangeDate ? displayDate(request.shiftChangeDate) : EMPTY_VALUE} />
          <InfoRow icon="message-square" label="Reason" value={request.reason || EMPTY_VALUE} />
        </>
      );
    default: {
      const model = text(request.raw.device_model);
      const os = text(request.raw.device_os);
      return (
        <>
          {model ? <InfoRow icon="smartphone" label="Device" value={model} /> : null}
          {os ? <InfoRow icon="layers" label="OS" value={os} /> : null}
          <InfoRow icon="message-square" label="Reason" value={request.reason || EMPTY_VALUE} />
        </>
      );
    }
  }
}

/** One of the four approval lists. Same card / confirm / busy pattern, per-type data and status rules. */
export function RequestListScreen({ type }: { type: RequestType }) {
  const cfg = CONFIG[type];
  const session = useSession();
  const orgId = useOrgId();
  const list = useRequestList(type);
  const { decide, busy } = useDecideRequest(type);
  const { query } = list;

  const sorted = useMemo(() => sortNewestFirst(list.requests), [list.requests]);
  const groups = useMemo(() => (type === 'permission' ? groupPermissionsByDate(list.requests) : []), [type, list.requests]);
  const hasCards = type === 'permission' ? groups.length > 0 : sorted.length > 0;

  let body: React.ReactNode;
  if (list.isInitialLoading) {
    body = <SkeletonList count={4} />;
  } else if (query.isError && !query.data) {
    body = <ErrorState message={getErrorMessage(query.error, 'Failed to load requests')} onRetry={() => void query.refetch()} />;
  } else if (!hasCards) {
    body = <EmptyState icon={cfg.emptyIcon} title={cfg.empty} />;
  } else if (type === 'permission') {
    body = (
      <View style={{ gap: spacing.xl }}>
        {groups.map((g) => (
          <View key={g.date} style={{ gap: spacing.md }}>
            <SectionHeader title={displayDate(g.date)} />
            <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
              {g.entries.map((e) => (
                <ApprovalCard
                  key={e.key}
                  testID={`request-${e.key}`}
                  request={e.request}
                  status={e.status}
                  busy={busy}
                  onDecide={(status, isChange) => void decide({ request: e.request, status, date: e.date, isChange })}
                >
                  <CardBody request={e.request} date={e.date} />
                </ApprovalCard>
              ))}
            </ResponsiveRow>
          </View>
        ))}
      </View>
    );
  } else {
    body = (
      <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
        {sorted.map((r) => (
          <ApprovalCard
            key={r.id}
            testID={`request-${r.id}`}
            request={r}
            status={type === 'leave' ? overallStatus(r) : r.status}
            busy={busy}
            top={type === 'leave' ? <LeaveTop request={r} /> : undefined}
            onDecide={(status, isChange) => void decide({ request: r, status, isChange })}
          >
            <CardBody request={r} />
          </ApprovalCard>
        ))}
      </ResponsiveRow>
    );
  }

  return (
    <Screen
      title={cfg.title}
      subtitle={session?.orgName || undefined}
      refreshing={list.refreshing}
      onRefresh={() => void list.refresh()}
      right={list.pendingCount > 0 ? <Badge label={`${list.pendingCount} Pending`} tone="warning" /> : undefined}
      testID={`requests-${type}`}
      overlay={<LoadingOverlay visible={busy} message="Processing..." />}
    >
      {orgId === '' ? null : body}
    </Screen>
  );
}
