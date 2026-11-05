import React from 'react';
import { View } from 'react-native';

import { Card, ListItem, SectionHeader, StatCard, Switch, Text } from '@/components/ui';
import { ResponsiveRow } from '@/components/layout';
import { formatMonthYear } from '@/lib/datetime';
import { spacing } from '@/theme';
import type { StaffDetail } from '@/types/api/staff';
import type { IconName, MonthYear } from '@/components/ui';

import type { MonthAttendance } from '../../hooks/useMonthAttendance';
import { summarizeMonth } from '../../utils/attendanceDerive';

export interface OverviewTabProps {
  detail: StaffDetail;
  attendance: MonthAttendance;
  period: MonthYear;
  isActive: boolean;
  togglingActive: boolean;
  onToggleActive: (active: boolean) => void;
}

/** Contact / organisation details, a snapshot of the selected month, and the active switch. */
export function OverviewTab({ detail, attendance, period, isActive, togglingActive, onToggleActive }: OverviewTabProps) {
  const summary = summarizeMonth(attendance.cells);
  const rows: [string, string, IconName][] = [
    ['Employee ID', detail.empId, 'hash'],
    ['Department', detail.department, 'briefcase'],
    ['Branch', detail.branch, 'building'],
    ['Branch address', detail.branchAddress, 'map-pin'],
    ['Email', detail.email, 'mail'],
    ['Mobile', detail.mobile, 'phone'],
  ];

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Details" />
        <Card padding={0}>
          {rows.map(([label, value, icon], i) => (
            <ListItem key={label} icon={icon} iconTone="primary" title={value || '-'} subtitle={label} divider={i < rows.length - 1} />
          ))}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Month snapshot" subtitle={formatMonthYear(period.year, period.month)} />
        <ResponsiveRow columns={{ phone: 2, tablet: 3, desktop: 3 }}>
          <StatCard label="Present" value={summary.present} icon="user-check" tone="success" loading={attendance.isLoading} />
          <StatCard label="Late" value={summary.late} icon="clock" tone="warning" loading={attendance.isLoading} />
          <StatCard label="Half day" value={summary.half} icon="hourglass" tone="primary" loading={attendance.isLoading} />
          <StatCard label="Absent" value={summary.absent} icon="user-x" tone="danger" loading={attendance.isLoading} />
          <StatCard label="Leave" value={summary.leave} icon="calendar-x" tone="info" loading={attendance.isLoading} />
        </ResponsiveRow>
        {attendance.isError ? (
          <Text variant="caption" color="danger">
            {attendance.errorMessage}
          </Text>
        ) : null}
      </View>

      <Card>
        <Switch
          label="Active"
          description="Inactive staff cannot punch in. Deactivating returns you to the staff list."
          value={isActive}
          disabled={togglingActive}
          onValueChange={onToggleActive}
          testID="detail-active-switch"
        />
      </Card>
    </View>
  );
}
