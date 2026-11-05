import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Badge, EmptyState, SectionHeader, useConfirm } from '@/components/ui';
import { spacing } from '@/theme';
import type { CarryForwardRequest } from '@/types/api/leads';

import { useCfrAction } from '../../hooks/useAdminLeads';
import type { CfrDateFilterKey } from '../../types';
import { orderCfrRequests, pendingCfrCount } from '../../utils/carryForward';
import { displayDate, resolveFilterDate } from '../../utils/dates';
import { DateChipBar } from '../DateChipBar';
import { DatePickerModal } from '../DatePickerModal';
import { CfrCard } from './CfrCard';

/** Carry Forward Requests inbox: filter by submitted day, approve (with confirmation) or reject (immediately). */
export function CfrSection({ requests }: { requests: CarryForwardRequest[] }) {
  const confirm = useConfirm();
  const { act, actioningId, busy } = useCfrAction();
  const [filter, setFilter] = useState<CfrDateFilterKey>('all');
  const [customDate, setCustomDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selected = resolveFilterDate(filter, customDate);
  const list = useMemo(() => orderCfrRequests(requests, selected), [requests, selected]);
  const pending = pendingCfrCount(list);

  const approve = async (request: CarryForwardRequest) => {
    const ok = await confirm({
      title: 'Approve Request?',
      message: `Confirm approval of this carry forward request?\nRequested for: ${displayDate(request.requestDate)}`,
      confirmText: 'Yes, Approve',
      cancelText: 'Cancel',
    });
    if (ok) act({ requestId: request.id, action: 'approved' });
  };

  const resetToAll = () => {
    setCustomDate('');
    setFilter('all');
  };

  return (
    <View style={{ gap: spacing.lg }} testID="crm-cfr-section">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <SectionHeader title="Carry Forward Requests" />
        </View>
        {pending > 0 ? <Badge label={`${pending} pending`} tone="danger" testID="crm-cfr-pending-count" /> : null}
      </View>
      <DateChipBar
        includeAll
        value={filter}
        customDate={customDate}
        onChange={setFilter}
        onPickDate={() => setCalendarOpen(true)}
        onClearCustom={resetToAll}
      />
      {list.length === 0 ? (
        <EmptyState compact icon="history" title="No requests" message="No carry forward requests for this selection." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {list.map((request) => (
            <CfrCard
              key={request.id}
              request={request}
              busy={busy}
              acting={actioningId === request.id}
              onApprove={approve}
              onReject={(r) => act({ requestId: r.id, action: 'rejected' })}
            />
          ))}
        </View>
      )}
      <DatePickerModal
        visible={calendarOpen}
        value={customDate}
        title="Submitted on"
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setCustomDate(d);
          setFilter('custom');
        }}
        onClear={resetToAll}
      />
    </View>
  );
}
