import React, { useMemo } from 'react';
import { View } from 'react-native';

import { FormSection, ResponsiveRow } from '@/components/layout';
import { Button, DateField, Select, Switch, Text, TextField, type SelectOption } from '@/components/ui';
import { formatTime12, todayIST } from '@/lib/datetime';
import { spacing } from '@/theme';
import type { Shift } from '@/types/api/shifts';
import type { BranchOption, DepartmentOption } from '@/types/api/staff';

import { GENDER_CHOICES, shiftSubtitle, type StaffFormErrors, type StaffFormValues } from '../utils/staffForm';
import { StaffPhotoField } from './StaffPhotoField';

type Props = {
  values: StaffFormValues;
  errors: StaffFormErrors;
  /** The deployment signs in by e-mail: the e-mail is required. */
  emailRequired?: boolean;
  setField: <K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) => void;
  branches: BranchOption[];
  departments: DepartmentOption[];
  shifts: Shift[];
  /** Branch / department / shift lists (and the suggested id) are still loading. */
  loading: boolean;
  disabled: boolean;
  photo: string | null;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
  showMore: boolean;
  onToggleMore: () => void;
  onAddShift: () => void;
};

/** Options + the current value when it is not among them (e.g. a branch that was renamed since). */
function withCurrent(options: SelectOption<string>[], current: string): SelectOption<string>[] {
  return current && !options.some((o) => o.value === current) ? [{ label: current, value: current }, ...options] : options;
}

export function StaffFormSections({
  values,
  errors,
  emailRequired = false,
  setField,
  branches,
  departments,
  shifts,
  loading,
  disabled,
  photo,
  onPickPhoto,
  onRemovePhoto,
  showMore,
  onToggleMore,
  onAddShift,
}: Props) {
  const branchOptions = useMemo(() => withCurrent(branches.map((b) => ({ label: b.name, value: b.name })), values.branchName), [branches, values.branchName]);
  const deptOptions = useMemo(() => withCurrent(departments.map((d) => ({ label: d.name, value: d.name })), values.deptName), [departments, values.deptName]);
  const genderOptions = useMemo(() => withCurrent(GENDER_CHOICES.map((g) => ({ label: g, value: g as string })), values.gender), [values.gender]);
  const shiftOptions = useMemo<SelectOption<number>[]>(
    () =>
      shifts.map((s) => ({
        label: s.name,
        value: s.id,
        subtitle: shiftSubtitle(s.startTime ? formatTime12(s.startTime) : '', s.endTime ? formatTime12(s.endTime) : ''),
      })),
    [shifts],
  );
  const placeholderFor = (text: string) => (loading ? 'Loading...' : text);

  return (
    <View style={{ gap: spacing.lg }}>
      <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }} gap={spacing.lg}>
        <FormSection title="Basic details">
          <StaffPhotoField uri={photo} name={values.name} disabled={disabled} onPick={onPickPhoto} onRemove={onRemovePhoto} />
          <TextField
            label="Full Name"
            required
            value={values.name}
            onChangeText={(t) => setField('name', t)}
            placeholder="Enter full name"
            leftIcon="user"
            error={errors.name}
            editable={!disabled}
            testID="staff-name"
          />
          <TextField
            label="Employee ID"
            required
            value={values.empId}
            onChangeText={(t) => setField('empId', t)}
            placeholder={placeholderFor('Enter employee ID')}
            leftIcon="hash"
            error={errors.empId}
            editable={!disabled}
            testID="staff-emp-id"
          />
          <TextField
            label="Phone Number"
            required
            value={values.phone}
            onChangeText={(t) => setField('phone', t)}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
            maxLength={10}
            prefix="+91"
            error={errors.phone}
            editable={!disabled}
            testID="staff-phone"
          />
          <TextField
            label="Email Address"
            required={emailRequired}
            error={errors.email}
            value={values.email}
            onChangeText={(t) => setField('email', t)}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail"
            editable={!disabled}
            testID="staff-email"
          />
        </FormSection>

        <FormSection title="Assignment">
          <Select
            label="Branch Name"
            required
            searchable
            value={values.branchName || null}
            options={branchOptions}
            onChange={(v) => setField('branchName', v)}
            placeholder={placeholderFor('Select Branch')}
            leftIcon="building"
            error={errors.branchName}
            disabled={disabled}
            testID="staff-branch"
          />
          <Select
            label="Department Name"
            required
            searchable
            value={values.deptName || null}
            options={deptOptions}
            onChange={(v) => setField('deptName', v)}
            placeholder={placeholderFor('Select Department')}
            leftIcon="briefcase"
            error={errors.deptName}
            disabled={disabled}
            testID="staff-dept"
          />
          <Select
            label="Gender"
            required
            value={values.gender || null}
            options={genderOptions}
            onChange={(v) => setField('gender', v)}
            placeholder="Select Gender"
            leftIcon="user"
            error={errors.gender}
            disabled={disabled}
            testID="staff-gender"
          />
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="callout" weight="semibold" color="textSecondary">
                Shift
              </Text>
              <Button title="+ Add Shift" size="sm" variant="ghost" onPress={onAddShift} disabled={disabled} testID="staff-add-shift" />
            </View>
            <Select
              value={values.shiftId !== 0 ? values.shiftId : null}
              options={shiftOptions}
              onChange={(v) => setField('shiftId', v)}
              placeholder={placeholderFor('Select Shift')}
              title="Shift"
              leftIcon="clock"
              disabled={disabled}
              testID="staff-shift"
            />
          </View>
          <Switch
            label="Field Staff"
            description="Enable if this employee works in the field"
            value={values.isFieldStaff}
            onValueChange={(on) => setField('isFieldStaff', on)}
            disabled={disabled}
          />
        </FormSection>
      </ResponsiveRow>

      {showMore ? (
        <FormSection title="More details" description="Personal and bank details (optional)">
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.lg}>
            <DateField
              label="Date of Birth"
              placeholder="Select Date of Birth"
              value={values.dob}
              onChange={(d) => setField('dob', d)}
              maxDate={todayIST()}
              disabled={disabled}
              testID="staff-dob"
            />
            <TextField
              label="Blood Group"
              value={values.bloodGroup}
              onChangeText={(t) => setField('bloodGroup', t)}
              placeholder="e.g., A+, B-, O+"
              editable={!disabled}
            />
            <TextField
              label="Emergency Contact Number"
              value={values.emergencyContact}
              onChangeText={(t) => setField('emergencyContact', t)}
              placeholder="Enter emergency contact number"
              keyboardType="phone-pad"
              editable={!disabled}
            />
            <TextField
              label="Address"
              value={values.address}
              onChangeText={(t) => setField('address', t)}
              placeholder="Enter address"
              multiline
              numberOfLines={3}
              editable={!disabled}
            />
            <TextField
              label="Bank Name"
              value={values.bankName}
              onChangeText={(t) => setField('bankName', t)}
              placeholder="Enter bank name"
              editable={!disabled}
            />
            <TextField
              label="Bank Branch"
              value={values.bankBranch}
              onChangeText={(t) => setField('bankBranch', t)}
              placeholder="Enter bank branch"
              editable={!disabled}
            />
            <TextField
              label="Account Number"
              value={values.accNo}
              onChangeText={(t) => setField('accNo', t)}
              placeholder="Enter account number"
              keyboardType="number-pad"
              editable={!disabled}
            />
            <TextField
              label="IFSC Code"
              value={values.ifsc}
              onChangeText={(t) => setField('ifsc', t)}
              placeholder="Enter IFSC code"
              autoCapitalize="characters"
              editable={!disabled}
            />
          </ResponsiveRow>
        </FormSection>
      ) : null}

      <Button
        title={showMore ? 'Hide More Details' : 'Add More Details'}
        variant="secondary"
        icon={showMore ? 'chevron-up' : 'chevron-down'}
        onPress={onToggleMore}
        testID="staff-toggle-more"
      />
    </View>
  );
}
