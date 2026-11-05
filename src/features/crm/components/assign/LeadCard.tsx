import React from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Button, Card, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { CrmLead } from '../../types';
import { cfrBannerTitle, cfrStateOf } from '../../utils/carryForward';
import { displayDate } from '../../utils/dates';
import { assignActionFor, isLeadLocked } from '../../utils/workStatus';
import { InfoRow } from '../InfoRow';
import { CfrStatusBadge } from '../StatusBadge';

export interface LeadCardProps {
  lead: CrmLead;
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onAssign: (lead: CrmLead) => void;
}

/** One lead of the View / Assign list: CFR banner, details and Edit / Delete / Assign actions (locked when completed). */
export function LeadCard({ lead, onEdit, onDelete, onAssign }: LeadCardProps) {
  const { colors } = useTheme();
  const cf = lead.carryForward;
  const locked = isLeadLocked(lead);
  const cfrState = cfrStateOf(lead);
  const banner = cfrBannerTitle(lead);
  const action = assignActionFor(lead);

  const assignLabel = locked ? 'Done' : action === 'reassign' ? 'Reassign' : 'Assign';
  const assignVariant = action === 'reassign' ? 'secondary' : 'primary';

  return (
    <Card padding={0} testID={`crm-lead-card-${lead.id}`} style={{ overflow: 'hidden', opacity: locked ? 0.6 : 1 }}>
      <View
        style={{
          padding: spacing.lg,
          gap: spacing.md,
          borderLeftWidth: cf ? 3 : 0,
          borderLeftColor: colors.statusHalfDay,
          backgroundColor: cf ? colors.primarySoft : undefined,
        }}
      >
        {cf && banner ? (
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text variant="callout" weight="bold" color={colors.statusHalfDay} style={{ flex: 1 }}>
                {banner}
              </Text>
              <CfrStatusBadge status={cf.status} size="sm" />
            </View>
            {cf.previousStaffName ? (
              <Text variant="caption" color="textSecondary">
                {`Previously: ${cf.previousStaffName}`}
              </Text>
            ) : null}
          </View>
        ) : null}
        {locked ? <Badge label="Completed" tone="success" icon="check" /> : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={lead.clientName || '?'} size={44} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {lead.clientName}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {lead.mobile ? <Badge label={lead.mobile} icon="phone" size="sm" /> : null}
              {lead.categoryName ? <Badge label={lead.categoryName} icon="tag" size="sm" tone="primary" /> : null}
            </View>
          </View>
        </View>

        <View style={{ gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md }}>
          <InfoRow icon="map-pin" label="Location" value={lead.address || 'N/A'} />
          {lead.requiredDate ? <InfoRow icon="calendar" label="Required Date" value={displayDate(lead.requiredDate)} /> : null}
          {cf && lead.createdOn ? <InfoRow icon="calendar-clock" label="Lead Created Date" value={displayDate(lead.createdOn)} /> : null}
          {lead.remarks ? <InfoRow icon="message-square" label="Remarks" value={lead.remarks} multiline /> : null}
          {cfrState === 'assigned' && lead.assignedUserName ? <InfoRow icon="user-check" label="Now Assigned To" value={lead.assignedUserName} /> : null}
        </View>

        {!cf && lead.assignedUserName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Badge label={`Assigned to: ${lead.assignedUserName}`} tone="success" icon="user-check" />
            {lead.requiredDate ? (
              <Text variant="caption" color="textMuted">
                {`Date: ${displayDate(lead.requiredDate)}`}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Edit" icon="edit" size="sm" variant="secondary" fullWidth disabled={locked} onPress={() => onEdit(lead)} testID={`crm-edit-${lead.id}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Delete" icon="trash" size="sm" variant="danger" fullWidth disabled={locked} onPress={() => onDelete(lead)} testID={`crm-delete-${lead.id}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={assignLabel} size="sm" variant={assignVariant} fullWidth disabled={locked} onPress={() => onAssign(lead)} testID={`crm-assign-${lead.id}`} />
          </View>
        </View>
      </View>
    </Card>
  );
}
