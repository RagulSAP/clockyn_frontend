import React from 'react';
import { View } from 'react-native';

import { useBreakpoint } from '@/components/layout';
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, Select, SectionHeader, SkeletonList, Text } from '@/components/ui';
import type { StaffPickerItem } from '@/api/staff';
import { spacing, useTheme } from '@/theme';

import type { CrmLead } from '../../types';
import { cfrAssignViewTitle } from '../../utils/carryForward';
import { displayDate } from '../../utils/dates';
import { InfoRow } from '../InfoRow';

export interface SelectOptionItem {
  id: string;
  name: string;
}

export interface AssignViewProps {
  lead: CrmLead;
  branches: SelectOptionItem[];
  departments: SelectOptionItem[];
  /** '' = all. */
  branchId: string;
  deptId: string;
  onBranchChange: (id: string) => void;
  onDeptChange: (id: string) => void;
  /** Employees (already de-duplicated, current assignee excluded). */
  employees: StaffPickerItem[];
  employeesLoading: boolean;
  employeesError: string | null;
  onRetryEmployees: () => void;
  assigning: boolean;
  onAssign: (employee: StaffPickerItem) => void;
}

/** The assign / reassign view: lead summary, branch + department filters and the employee list. */
export function AssignView({
  lead,
  branches,
  departments,
  branchId,
  deptId,
  onBranchChange,
  onDeptChange,
  employees,
  employeesLoading,
  employeesError,
  onRetryEmployees,
  assigning,
  onAssign,
}: AssignViewProps) {
  const { colors } = useTheme();
  const { isDesktop } = useBreakpoint();
  const cf = lead.carryForward;
  const cfTitle = cfrAssignViewTitle(lead);

  const summary = (
    <View style={{ gap: spacing.lg }}>
      {cf && cfTitle ? (
        <Card variant="muted" testID="crm-assign-cfr-banner">
          <Text variant="callout" weight="bold" color={colors.statusHalfDay}>
            {cfTitle}
          </Text>
          {cf.previousStaffName ? (
            <Text variant="caption" color="textSecondary">
              {`Previously: ${cf.previousStaffName}`}
            </Text>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <View style={{ gap: spacing.md }}>
          <SectionHeader title="Lead Details" />
          <InfoRow label="Name" value={lead.clientName} />
          <InfoRow label="Mobile" value={lead.mobile || 'N/A'} />
          <InfoRow label="Address" value={lead.address || 'N/A'} />
          <InfoRow label="Category" value={lead.categoryName || 'N/A'} />
          {lead.requiredDate ? <InfoRow label="Required Date" value={displayDate(lead.requiredDate)} /> : null}
          {lead.remarks ? <InfoRow label="Remarks" value={lead.remarks} multiline /> : null}
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Select<string>
            label="Branch"
            value={branchId}
            onChange={onBranchChange}
            options={[{ label: 'All Branches', value: '' }, ...branches.map((b) => ({ label: b.name, value: b.id }))]}
            testID="crm-assign-branch"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Select<string>
            label="Department"
            value={deptId}
            onChange={onDeptChange}
            options={[{ label: 'All Departments', value: '' }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
            testID="crm-assign-dept"
          />
        </View>
      </View>
    </View>
  );

  let list: React.ReactNode;
  if (employeesLoading) list = <SkeletonList count={4} />;
  else if (employeesError) list = <ErrorState message={employeesError} onRetry={onRetryEmployees} compact />;
  else if (employees.length === 0) list = <EmptyState compact icon="users" title="No employees found" message="Try another branch or department." />;
  else {
    list = (
      <View style={{ gap: spacing.sm }}>
        {employees.map((emp) => (
          <Card key={emp.userId} testID={`crm-employee-${emp.userId}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar name={emp.name || '?'} size={42} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {emp.name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Badge label={emp.branch || 'N/A'} icon="building" size="sm" />
                  <Badge label={emp.department || 'N/A'} icon="layers" size="sm" tone="primary" />
                </View>
              </View>
              <Button
                title={assigning ? 'Assigning...' : 'Assign'}
                size="sm"
                variant={cf ? 'primary' : 'secondary'}
                disabled={assigning}
                onPress={() => onAssign(emp)}
                testID={`crm-assign-employee-${emp.userId}`}
              />
            </View>
          </Card>
        ))}
      </View>
    );
  }

  const employeesBlock = (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title="Select Employee" />
      {list}
    </View>
  );

  if (isDesktop) {
    return (
      <View style={{ flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>{summary}</View>
        <View style={{ flex: 1 }}>{employeesBlock}</View>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.xl }}>
      {summary}
      {employeesBlock}
    </View>
  );
}
