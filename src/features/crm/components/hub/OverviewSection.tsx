import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, SectionHeader } from '@/components/ui';
import { spacing } from '@/theme';

import type { CrmLead, DateFilterKey, StatFilter } from '../../types';
import { resolveFilterDate } from '../../utils/dates';
import { countBuckets, filterByDate, filterByStat } from '../../utils/leads';
import { DateChipBar } from '../DateChipBar';
import { DatePickerModal } from '../DatePickerModal';
import { LeadRow } from './LeadRow';
import { StatsGrid } from './StatsGrid';

export interface OverviewSectionProps {
  leads: CrmLead[];
  onOpenDetail: (lead: CrmLead) => void;
  onAssign: (lead: CrmLead) => void;
}

/** "Work Status Overview": day chips, the six status cells and the lead-wise list for the chosen day. */
export function OverviewSection({ leads, onOpenDetail, onAssign }: OverviewSectionProps) {
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('today');
  const [customDate, setCustomDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [active, setActive] = useState<StatFilter>('total');

  const selected = resolveFilterDate(dateFilter, customDate);
  const dayLeads = useMemo(() => filterByDate(leads, selected), [leads, selected]);
  const counts = useMemo(() => countBuckets(dayLeads), [dayLeads]);
  const list = useMemo(() => filterByStat(dayLeads, active), [dayLeads, active]);

  const resetToToday = () => {
    setCustomDate('');
    setDateFilter('today');
  };

  return (
    <View style={{ gap: spacing.lg }} testID="crm-overview">
      <DateChipBar
        value={dateFilter}
        customDate={customDate}
        onChange={(v) => setDateFilter(v as DateFilterKey)}
        onPickDate={() => setCalendarOpen(true)}
        onClearCustom={resetToToday}
      />
      <SectionHeader title="Work Status Overview" />
      <StatsGrid counts={counts} active={active} onSelect={setActive} />
      <SectionHeader title="Lead-wise Status" />
      {list.length === 0 ? (
        <EmptyState compact icon="clipboard-list" title="No leads here" message="No leads match this day and status." />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {list.map((lead) => (
            <LeadRow key={lead.id} lead={lead} onPress={onOpenDetail} onAssign={onAssign} />
          ))}
        </View>
      )}
      <DatePickerModal
        visible={calendarOpen}
        value={customDate}
        title="Pick a date"
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setCustomDate(d);
          setDateFilter('custom');
        }}
        onClear={resetToToday}
      />
    </View>
  );
}
