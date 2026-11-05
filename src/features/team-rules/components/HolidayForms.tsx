import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Select, Switch, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { ALL_BRANCHES_LABEL, ALL_DEPARTMENTS_LABEL, selectedDateLabel } from '../utils/holidayLogic';

export const BLOCK_HINT_ON = 'Staff cannot punch in on this day';
export const BLOCK_HINT_OFF = 'Staff can still punch in if they choose';

export function BlockAttendanceSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Switch label="Block Attendance" description={value ? BLOCK_HINT_ON : BLOCK_HINT_OFF} value={value} onValueChange={onChange} testID="block-attendance" />;
}

export type ScopeSelectProps = {
  branches: string[];
  departments: string[];
  branch: string;
  dept: string;
  onBranch: (v: string) => void;
  onDept: (v: string) => void;
  /** `filter` = list filter wording ("All Depts"); `assign` = holiday scope wording. */
  variant: 'filter' | 'assign';
};

/** Branch + department pickers ('' = all). Scope is stored by NAME on the backend. */
export function ScopeSelects({ branches, departments, branch, dept, onBranch, onDept, variant }: ScopeSelectProps) {
  const branchOptions = useMemo(() => [{ label: ALL_BRANCHES_LABEL, value: '' }, ...branches.map((b) => ({ label: b, value: b }))], [branches]);
  const deptOptions = useMemo(
    () => [{ label: variant === 'filter' ? 'All Depts' : ALL_DEPARTMENTS_LABEL, value: '' }, ...departments.map((d) => ({ label: d, value: d }))],
    [departments, variant],
  );
  const prefix = variant === 'filter' ? 'filter' : 'scope';
  return (
    // wraps (stacks) when the row is too narrow for two readable pickers (phone selection card: "All Bran...")
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      <Select
        label="Branch"
        title={variant === 'filter' ? 'Filter by Branch' : 'Select Branch'}
        value={branch}
        options={branchOptions}
        onChange={onBranch}
        leftIcon="building"
        style={{ flexGrow: 1, flexBasis: 170, minWidth: 170 }}
        testID={`${prefix}-branch`}
      />
      <Select
        label="Department"
        title={variant === 'filter' ? 'Filter by Department' : 'Select Department'}
        value={dept}
        options={deptOptions}
        onChange={onDept}
        leftIcon="tag"
        style={{ flexGrow: 1, flexBasis: 170, minWidth: 170 }}
        testID={`${prefix}-dept`}
      />
    </View>
  );
}

export type SelectedDatesCardProps = {
  dates: string[];
  name: string;
  onName: (v: string) => void;
  branch: string;
  dept: string;
  onBranch: (v: string) => void;
  onDept: (v: string) => void;
  branches: string[];
  departments: string[];
  block: boolean;
  onBlock: (v: boolean) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
};

/** Form shown once dates are tapped on the calendar: name, scope, punch policy. */
export function SelectedDatesCard(p: SelectedDatesCardProps) {
  return (
    <Card testID="selected-dates-card">
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text variant="title3">Selected Date</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {p.dates.map((d) => (
              <Badge key={d} label={selectedDateLabel(d)} tone="primary" />
            ))}
          </View>
        </View>
        <TextField
          label="Holiday Name"
          value={p.name}
          onChangeText={p.onName}
          placeholder="e.g. Diwali, Christmas, New Year"
          required
          testID="holiday-name"
        />
        <ScopeSelects branches={p.branches} departments={p.departments} branch={p.branch} dept={p.dept} onBranch={p.onBranch} onDept={p.onDept} variant="assign" />
        <BlockAttendanceSwitch value={p.block} onChange={p.onBlock} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={p.onCancel} disabled={p.saving} style={{ flex: 1 }} testID="holiday-cancel" />
          <Button title="Add Holiday" onPress={p.onSave} loading={p.saving} style={{ flex: 1 }} testID="holiday-add" />
        </View>
      </View>
    </Card>
  );
}
