import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, IconButton, Text, TextField } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { LeadFormField, LeadFormValues } from '../utils/leadForm';
import { sanitizeMobile } from '../utils/leadForm';
import { displayDate } from '../utils/dates';
import { CategoryPicker } from './CategoryPicker';
import { DatePickerModal } from './DatePickerModal';

export interface LeadFormProps {
  values: LeadFormValues;
  onChange: (patch: Partial<LeadFormValues>) => void;
  /** Inline field errors from `validateLeadForm`. */
  errors: Partial<Record<LeadFormField, string>>;
  /** Admins may delete categories; the staff sheet may not. */
  allowCategoryDelete?: boolean;
  disabled?: boolean;
}

/**
 * The lead fields shared by the admin Enter / Edit Lead screen and the staff Add Lead sheet:
 * name, mobile (digits only, 10), address, category, remarks and the optional customer-required date.
 */
export function LeadForm({ values, onChange, errors, allowCategoryDelete, disabled }: LeadFormProps) {
  const { colors } = useTheme();
  const [dateOpen, setDateOpen] = useState(false);

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField label="Name" required value={values.name} onChangeText={(t) => onChange({ name: t })} placeholder="Enter full name" error={errors.name} editable={!disabled} leftIcon="user" />
      <TextField
        label="Mobile"
        required
        value={values.mobile}
        onChangeText={(t) => onChange({ mobile: sanitizeMobile(t) })}
        placeholder="Enter mobile number"
        keyboardType="phone-pad"
        // no maxLength: a pasted "98765 43210" would be cut BEFORE the digits-only sanitiser and lose a digit
        error={errors.mobile}
        editable={!disabled}
        leftIcon="phone"
      />
      <TextField label="Address" required value={values.address} onChangeText={(t) => onChange({ address: t })} placeholder="Enter address" error={errors.address} editable={!disabled} leftIcon="map-pin" />
      <CategoryPicker value={values.category} onChange={(category) => onChange({ category })} error={errors.category} allowDelete={allowCategoryDelete} disabled={disabled} />
      <TextField label="Remarks" value={values.remarks} onChangeText={(t) => onChange({ remarks: t })} placeholder="Enter remarks" multiline numberOfLines={3} editable={!disabled} />

      <View style={{ gap: spacing.xs }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Customer Required Date
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customer required date"
          disabled={disabled}
          onPress={() => setDateOpen(true)}
          testID="crm-required-date"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            height: 50,
            paddingHorizontal: spacing.lg,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="calendar" size={18} color="textMuted" />
          <Text variant="body" color={values.requiredDate ? 'text' : 'textMuted'} style={{ flex: 1 }}>
            {values.requiredDate ? displayDate(values.requiredDate) : 'Select a date (optional)'}
          </Text>
          {values.requiredDate ? (
            <IconButton icon="x" size="sm" accessibilityLabel="Clear required date" onPress={() => onChange({ requiredDate: '' })} />
          ) : (
            <Icon name="chevron-right" size={18} color="textMuted" />
          )}
        </Pressable>
      </View>
      <DatePickerModal
        visible={dateOpen}
        value={values.requiredDate}
        title="Customer required date"
        showToday
        onClose={() => setDateOpen(false)}
        onSelect={(requiredDate) => onChange({ requiredDate })}
        onClear={() => onChange({ requiredDate: '' })}
      />
    </View>
  );
}
