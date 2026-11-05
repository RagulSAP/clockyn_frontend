import React from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Card, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

import type { CrmLead } from '../../types';
import { cfrRowLine } from '../../utils/carryForward';
import { displayDate } from '../../utils/dates';
import { normaliseWorkStatus } from '../../utils/workStatus';
import { VioletBadge, WorkStatusBadge, workStatusColor } from '../StatusBadge';

export interface LeadRowProps {
  lead: CrmLead;
  /** Opens the read-only Lead Details sheet. */
  onPress: (lead: CrmLead) => void;
  /** The "Unassigned" / "Assign" pill: jumps into the assign view for this lead. */
  onAssign: (lead: CrmLead) => void;
}

/** One row of the "Lead-wise Status" list. Carry-forward leads get a violet border. */
export function LeadRow({ lead, onPress, onAssign }: LeadRowProps) {
  const { colors } = useTheme();
  const isCfr = lead.carryForward !== null;
  const assigned = !!lead.assignedUserId;
  const status = normaliseWorkStatus(lead.workStatus);
  const accent = isCfr ? colors.statusHalfDay : workStatusColor(colors, status);
  const cfrLine = cfrRowLine(lead);
  const secondLine = cfrLine ?? (assigned ? lead.assignedUserName : null);

  return (
    <Card padding={0} onPress={() => onPress(lead)} testID={`crm-lead-row-${lead.id}`} accessibilityLabel={lead.clientName} style={{ overflow: 'hidden' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          borderLeftWidth: 3,
          borderLeftColor: accent,
          backgroundColor: isCfr ? colors.primarySoft : undefined,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {lead.clientName}
          </Text>
          {secondLine ? (
            <Text variant="caption" color={isCfr ? colors.statusHalfDay : 'textSecondary'} numberOfLines={1}>
              {secondLine}
            </Text>
          ) : null}
          {lead.effectiveDate ? (
            <Text variant="caption" color="textMuted">
              {displayDate(lead.requiredDate ?? lead.effectiveDate)}
            </Text>
          ) : null}
        </View>
        {assigned ? (
          isCfr ? (
            <VioletBadge label="CFR" />
          ) : (
            <WorkStatusBadge status={status} />
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${isCfr ? 'Assign' : 'Unassigned'} ${lead.clientName}`}
            onPress={() => onAssign(lead)}
            testID={`crm-assign-pill-${lead.id}`}
            hitSlop={8}
          >
            {isCfr ? <VioletBadge label="Assign" icon="user-plus" /> : <Badge label="Unassigned" tone="danger" icon="user-x" />}
          </Pressable>
        )}
      </View>
    </Card>
  );
}
