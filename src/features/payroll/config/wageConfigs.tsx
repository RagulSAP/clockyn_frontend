import React from 'react';
import { Badge, TextField } from '@/components/ui';
import {
  assignWages,
  deleteWageTemplate,
  listWageStaff,
  listWageTemplates,
  saveWageTemplate,
  unassignWages,
} from '@/api/payroll';
import { formatINR } from '@/lib/format';
import type { WageKind, WageTemplate } from '@/types/api/payroll';
import { liveAmountError } from '../utils/numbers';
import { templateDisplayName } from '../utils/templates';
import { validateWageForm, wageAmount, wageFormFromItem, type WageFormValues, type WageItem } from '../utils/wageForm';
import type { TemplateTypeConfig } from './types';

const toWageItem = (t: WageTemplate): WageItem => ({ id: t.id, name: t.name ?? '', assignedCount: t.assignedCount, amount: t.amount });

const AMOUNT_BADGE = (item: WageItem) => <Badge label={formatINR(item.amount)} tone="success" />;

function wageApi(kind: WageKind) {
  return {
    list: async (orgId: string) => (await listWageTemplates(kind, orgId)).map(toWageItem),
    remove: (id: string) => deleteWageTemplate(kind, id),
    listStaff: listWageStaff,
    assign: assignWages,
    unassign: unassignWages,
  };
}

function wageSave(kind: WageKind): TemplateTypeConfig<WageItem, WageFormValues>['save'] {
  return async ({ orgId, form, editing }) => {
    await saveWageTemplate(kind, { orgId, amount: wageAmount(form), id: editing?.id });
  };
}

function amountField(label: string): TemplateTypeConfig<WageItem, WageFormValues>['fields'] {
  return function AmountFields(api) {
    return (
      <TextField
        label={label}
        required
        value={api.values.amount}
        onChangeText={(text) => {
          api.setValue('amount', text);
          api.setError('amount', liveAmountError(text));
        }}
        error={api.errors.amount || null}
        placeholder="Enter amount"
        prefix="₹"
        inputMode="decimal"
        keyboardType="decimal-pad"
        editable={!api.disabled}
        testID="field-amount"
      />
    );
  };
}

const MESSAGES = {
  saved: 'Template Saved!',
  updated: 'Template Updated!',
  deleted: 'Template Deleted!',
  saveFailed: 'Failed to save template',
  deleteFailed: 'Failed to delete template',
};

/** Daily wages ("Day Pay N"): amount paid if one day present. */
export const dailyWagesConfig: TemplateTypeConfig<WageItem, WageFormValues> = {
  kind: 'daily-wages',
  title: 'Daily Wages',
  addLabel: 'Add',
  listLabel: 'All Daily Wages',
  icon: 'calendar',
  itemTitle: (item, index) => `Day Pay ${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Day Pay ${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this template?',
  renderBadges: AMOUNT_BADGE,
  messages: MESSAGES,
  formDismissible: true,
  initialForm: wageFormFromItem,
  fields: amountField('If one day present'),
  validate: (form, ctx) => validateWageForm(form, ctx),
  save: wageSave('daily'),
  api: wageApi('daily'),
  assign: {
    title: 'Assign Staff',
    hint: 'Assigning a staff member here moves them off their other Day Pay template.',
  },
};

/** Hourly charges ("Hour-Pay-N"): amount paid if one hour present; amounts must be unique. */
export const hourlyConfig: TemplateTypeConfig<WageItem, WageFormValues> = {
  kind: 'hourly',
  title: 'Hourly Charges',
  addLabel: 'Add',
  listLabel: 'All Hourly Charges',
  icon: 'timer',
  itemTitle: (item, index) => `Hour-Pay-${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Hour-Pay-${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this template?',
  renderBadges: AMOUNT_BADGE,
  messages: MESSAGES,
  initialForm: wageFormFromItem,
  fields: amountField('If one hour present'),
  validate: (form, ctx) => validateWageForm(form, { ...ctx, duplicateLabel: 'Hour-Pay-' }),
  save: wageSave('hourly'),
  api: wageApi('hourly'),
  assign: {
    title: 'Assign Staff',
    hint: 'Assigning a staff member here moves them off their other Hour-Pay template.',
  },
};
