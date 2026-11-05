import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Spinner, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { displayDate } from '../../utils/dates';
import type { EmployeeLead } from '../../utils/employeeLeads';
import { InfoRow } from '../InfoRow';
import { WorkStatusBadge } from '../StatusBadge';

export interface EmpLeadCardProps {
  lead: EmployeeLead;
  /** This lead's status is being saved (spinner, control disabled). */
  updating: boolean;
  onOpenStatus: (lead: EmployeeLead) => void;
}

/** A lead assigned to me: details + the work-status control, or the violet "Carry Forward Requested" card. */
export function EmpLeadCard({ lead, updating, onOpenStatus }: EmpLeadCardProps) {
  const { colors } = useTheme();
  const cfr = lead.pendingCfr;

  const details = (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <InfoRow icon="phone" label="Phone" value={lead.mobile || '-'} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <InfoRow icon="tag" label="Category" value={lead.categoryName || '-'} />
        </View>
      </View>
      {lead.address ? <InfoRow icon="map-pin" label="Location" value={lead.address} /> : null}
      {lead.remarks ? <InfoRow icon="message-square" label="Remarks" value={lead.remarks} multiline /> : null}
    </View>
  );

  if (cfr) {
    return (
      <Card padding={0} testID={`crm-emp-lead-${lead.id}`} style={{ overflow: 'hidden' }}>
        <View style={{ borderLeftWidth: 3, borderLeftColor: colors.statusHalfDay, backgroundColor: colors.primarySoft, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight="bold" color={colors.statusHalfDay}>
                Carry Forward Requested
              </Text>
              <Text variant="caption" color="textSecondary">
                Awaiting admin approval
              </Text>
            </View>
            <Badge label="PENDING" tone="warning" size="sm" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar name={lead.clientName || '?'} size={40} />
            <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {lead.clientName}
            </Text>
          </View>
          {cfr.description || cfr.requestDate ? (
            <View style={{ gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md }}>
              {cfr.description ? <InfoRow label="CFR Reason" value={cfr.description} multiline /> : null}
              {cfr.requestDate ? <InfoRow label="Requested For" value={displayDate(cfr.requestDate)} /> : null}
            </View>
          ) : null}
          {details}
        </View>
      </Card>
    );
  }

  return (
    <Card testID={`crm-emp-lead-${lead.id}`}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={lead.clientName || '?'} size={44} />
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {lead.clientName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Work status of ${lead.clientName}: ${lead.displayStatus}`}
          disabled={updating}
          onPress={() => onOpenStatus(lead)}
          testID={`crm-status-${lead.id}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Text variant="micro" color="textMuted">
            WORK STATUS
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {updating ? <Spinner /> : <WorkStatusBadge status={lead.displayStatus} />}
            <Icon name="chevron-down" size={16} color="textMuted" />
          </View>
        </Pressable>
        {details}
      </View>
    </Card>
  );
}
