import React from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Divider, Icon, StatusPill, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { RequestStatus, StaffRequest } from '@/types/api/requests';

import { oppositeDecision, displayDate } from '../utils/requestLogic';

/** One "icon tile + label + value" line of a request card. */
export function InfoRow({ icon, label, value, emphasis }: { icon: IconName; label: string; value: string; emphasis?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <View
        style={{ width: 28, height: 28, borderRadius: radii.xs + 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name={icon} size={15} color="primary" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="micro" color="textMuted">
          {label.toUpperCase()}
        </Text>
        <Text variant={emphasis ? 'bodyStrong' : 'body'} color={emphasis ? 'primary' : 'text'}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export type ApprovalCardProps = {
  request: StaffRequest;
  /** Status shown on the pill and used to pick the actions (per date for permission cards). */
  status: RequestStatus;
  busy: boolean;
  onDecide: (status: 'approved' | 'rejected', isChange: boolean) => void;
  /** Rendered above the staff row (the leave dates strip). */
  top?: React.ReactNode;
  children?: React.ReactNode;
  testID?: string;
};

/**
 * Shared card of the four request lists: staff row + status pill, type specific rows, and the actions
 * (Approve / Reject while pending, otherwise a single "Change to ..." button). Decisions are confirmed by the caller.
 */
export function ApprovalCard({ request, status, busy, onDecide, top, children, testID }: ApprovalCardProps) {
  const pending = status === 'pending';
  const change = oppositeDecision(status);
  const name = request.staffName?.trim() || 'Unknown';
  return (
    <Card testID={testID} style={{ gap: spacing.md }}>
      {top}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={request.photoUrl} name={request.staffName ?? '?'} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {`Submitted ${displayDate(request.createdAt)}`}
          </Text>
        </View>
        <StatusPill status={status} />
      </View>
      {children ? <Divider /> : null}
      {children ? <View style={{ gap: spacing.md }}>{children}</View> : null}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {pending ? (
          <>
            <Button
              title="Reject"
              variant="danger"
              icon="x"
              disabled={busy}
              onPress={() => onDecide('rejected', false)}
              style={{ flex: 1 }}
              testID={testID ? `${testID}-reject` : undefined}
            />
            <Button
              title="Approve"
              variant="success"
              icon="check"
              disabled={busy}
              onPress={() => onDecide('approved', false)}
              style={{ flex: 1 }}
              testID={testID ? `${testID}-approve` : undefined}
            />
          </>
        ) : (
          <Button
            title={change === 'rejected' ? 'Change to Reject' : 'Change to Approve'}
            variant="secondary"
            icon="refresh"
            disabled={busy}
            onPress={() => onDecide(change, true)}
            fullWidth
            testID={testID ? `${testID}-change` : undefined}
          />
        )}
      </View>
    </Card>
  );
}
