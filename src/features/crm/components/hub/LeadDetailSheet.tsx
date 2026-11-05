import React from 'react';
import { View } from 'react-native';

import { Badge, BottomSheet, Text } from '@/components/ui';
import { spacing } from '@/theme';

import type { CrmLead } from '../../types';
import { displayDate } from '../../utils/dates';
import { normaliseWorkStatus } from '../../utils/workStatus';
import { InfoRow } from '../InfoRow';
import { WorkStatusBadge } from '../StatusBadge';

export interface LeadDetailSheetProps {
  lead: CrmLead | null;
  onClose: () => void;
}

/** Read-only "Lead Details" sheet of the hub. */
export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  return (
    <BottomSheet visible={lead !== null} onClose={onClose} title="Lead Details" testID="crm-lead-detail">
      {lead ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
            <Text variant="title3" style={{ flex: 1 }} numberOfLines={2}>
              {lead.clientName}
            </Text>
            {lead.assignedUserId ? <WorkStatusBadge status={normaliseWorkStatus(lead.workStatus)} /> : <Badge label="Unassigned" tone="danger" />}
          </View>
          <InfoRow icon="phone" label="Mobile" value={lead.mobile || 'N/A'} />
          <InfoRow icon="map-pin" label="Location" value={lead.address || 'N/A'} />
          <InfoRow icon="tag" label="Category" value={lead.categoryName || 'N/A'} />
          <InfoRow icon="user" label="Assigned To" value={lead.assignedUserName || 'Unassigned'} />
          <InfoRow icon="calendar" label="Date" value={displayDate(lead.requiredDate ?? lead.effectiveDate)} />
          {lead.remarks ? <InfoRow icon="message-square" label="Remarks" value={lead.remarks} multiline /> : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}
