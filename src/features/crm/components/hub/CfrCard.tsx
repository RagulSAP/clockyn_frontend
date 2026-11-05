import React from 'react';
import { View } from 'react-native';

import { Button, Card, Divider, Icon, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';
import type { CarryForwardRequest } from '@/types/api/leads';

import { displayDate } from '../../utils/dates';
import { CfrStatusBadge } from '../StatusBadge';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="micro" color="textMuted">
        {label}
      </Text>
      <Text variant="callout" style={{ flex: 1, textAlign: 'right' }} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

export interface CfrCardProps {
  request: CarryForwardRequest;
  /** True while this (or any) action is running - both buttons are disabled. */
  busy: boolean;
  /** True for the card whose action is running (spinner). */
  acting: boolean;
  onApprove: (request: CarryForwardRequest) => void;
  onReject: (request: CarryForwardRequest) => void;
}

/** One carry-forward request: employee, reason, requested-for date, submitted date and Approve / Reject. */
export function CfrCard({ request, busy, acting, onApprove, onReject }: CfrCardProps) {
  const { colors } = useTheme();
  const pending = request.status === 'pending';
  return (
    <Card padding={0} testID={`crm-cfr-${request.id}`} style={{ overflow: 'hidden' }}>
      <View style={{ borderLeftWidth: 3, borderLeftColor: colors.statusHalfDay, padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="user" size={16} color={colors.statusHalfDay} />
          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
            {request.clientName}
          </Text>
        </View>
        <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.md }}>
          <Field label="EMPLOYEE" value={request.employeeName || 'N/A'} />
          <Divider />
          <Field label="REASON" value={request.description || 'N/A'} />
          <Divider />
          <Field label="REQUESTED FOR DATE" value={displayDate(request.requestDate)} />
          <Divider />
          <Field label="SUBMITTED ON" value={displayDate(request.createdAt)} />
        </View>
        {pending ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button title="Approve" variant="success" icon="check" loading={acting} disabled={busy} fullWidth onPress={() => onApprove(request)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Reject" variant="danger" icon="x" loading={acting} disabled={busy} fullWidth onPress={() => onReject(request)} />
            </View>
          </View>
        ) : (
          <CfrStatusBadge status={request.status} />
        )}
      </View>
    </Card>
  );
}
