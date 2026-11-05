import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { Badge, Select, Text, TextField } from '@/components/ui';
import {
  assignIncentive,
  createBonusIncentive,
  createCountIncentive,
  createOvertimeIncentive,
  createTurnoverIncentive,
  deleteIncentive,
  getBonusAssignedUserIds,
  listBonusIncentives,
  listCountIncentives,
  listIncentiveStaff,
  listOvertimeIncentives,
  listTurnoverIncentives,
  unassignIncentive,
  updateBonusIncentive,
  updateCountIncentive,
  updateOvertimeIncentive,
  updateTurnoverIncentive,
} from '@/api/payroll';
import { currentMonthIST } from '@/lib/datetime';
import { formatINR, formatNumber } from '@/lib/format';
import type { BonusIncentive, CountIncentive, IncentiveKind, OvertimeIncentive, TurnoverIncentive } from '@/types/api/payroll';
import { DetailLine } from '../components/DetailLine';
import {
  BONUS_MONTHS,
  bonusFormFromItem,
  bonusPercentValue,
  bonusYearOptions,
  livePercentError,
  validateBonusForm,
  type BonusFormValues,
} from '../utils/bonusForm';
import {
  countFormFromItem,
  countValues,
  turnoverFormFromItem,
  turnoverValues,
  validateCountForm,
  validateTurnoverForm,
  type CountFormValues,
  type TurnoverFormValues,
} from '../utils/incentiveForms';
import { liveAmountError, liveWholeNumberError, parsePositive } from '../utils/numbers';
import {
  formatOvertimeDuration,
  liveMinutesError,
  overtimeFormFromItem,
  overtimeTotalMinutes,
  validateOvertimeForm,
  type OvertimeFormValues,
} from '../utils/overtimeForm';
import { decimalOnly, digitsOnly, templateDisplayName, type TemplateBase } from '../utils/templates';
import type { FormApi, TemplateApi, TemplateTypeConfig } from './types';

function incentiveApi<T extends TemplateBase>(kind: IncentiveKind, list: (orgId: string) => Promise<T[]>): TemplateApi<T> {
  return {
    list,
    remove: (id) => deleteIncentive(kind, id),
    listStaff: listIncentiveStaff,
    assign: assignIncentive,
    unassign: unassignIncentive,
  };
}

const INCENTIVE_MESSAGES = {
  saved: 'Saved Successfully!',
  updated: 'Updated Successfully!',
  deleted: 'Deleted Successfully!',
  saveFailed: 'Failed to save',
  deleteFailed: 'Failed to delete',
};

/* ------------------------------------------------------------------------------------------------ */
/* Overtime                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

/** Overtime ("Over Time N"): duration (hours : minutes) and the amount paid for it; durations must be unique. */
export const overtimeConfig: TemplateTypeConfig<OvertimeIncentive, OvertimeFormValues> = {
  kind: 'overtime',
  title: 'Overtime',
  addLabel: 'Add OT',
  listLabel: 'All Overtime',
  icon: 'timer',
  itemTitle: (item, index) => `Over Time ${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Over Time ${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this overtime?',
  renderBadges: (item) => (
    <>
      <Badge label={`⏱ ${formatOvertimeDuration(item.durationMinutes)}`} tone="primary" />
      <Badge label={formatINR(item.amount)} tone="success" />
    </>
  ),
  messages: INCENTIVE_MESSAGES,
  initialForm: overtimeFormFromItem,
  fields: (api) => (
    <>
      <View style={{ gap: spacing.xs }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Duration
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <TextField
            style={{ flex: 1 }}
            value={api.values.hours}
            onChangeText={(text) => {
              api.setValue('hours', digitsOnly(text));
              api.setError('hours', '');
            }}
            placeholder="Hours"
            accessibilityLabel="Hours"
            inputMode="numeric"
            keyboardType="number-pad"
            error={api.errors.hours || null}
            editable={!api.disabled}
            testID="field-hours"
          />
          <Text variant="title3" style={{ paddingTop: spacing.md }}>
            :
          </Text>
          <TextField
            style={{ flex: 1 }}
            value={api.values.minutes}
            onChangeText={(text) => {
              const filtered = digitsOnly(text);
              api.setValue('minutes', filtered);
              api.setError('minutes', liveMinutesError(filtered));
            }}
            placeholder="Minutes"
            accessibilityLabel="Minutes"
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={2}
            error={api.errors.minutes || null}
            editable={!api.disabled}
            testID="field-minutes"
          />
        </View>
      </View>
      <TextField
        label="Amount"
        value={api.values.amount}
        onChangeText={(text) => {
          api.setValue('amount', text);
          api.setError('amount', liveAmountError(text));
        }}
        placeholder="Enter amount"
        prefix="₹"
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={api.errors.amount || null}
        editable={!api.disabled}
        testID="field-amount"
      />
    </>
  ),
  validate: (form, ctx) => validateOvertimeForm(form, ctx),
  save: async ({ orgId, form, editing, nextName }) => {
    const durationMinutes = overtimeTotalMinutes(form);
    const amount = parsePositive(form.amount);
    if (amount === null) throw new Error('Amount must be a valid number');
    if (editing) await updateOvertimeIncentive(editing.id, { durationMinutes, amount });
    else await createOvertimeIncentive({ orgId, templateName: nextName, durationMinutes, amount });
  },
  api: incentiveApi('overtime', listOvertimeIncentives),
  assign: { title: 'Assign Staff' },
};

/* ------------------------------------------------------------------------------------------------ */
/* Bonus                                                                                             */
/* ------------------------------------------------------------------------------------------------ */

function BonusFields({ api }: { api: FormApi<BonusFormValues> }) {
  const { year: currentYear } = currentMonthIST();
  const monthOptions = BONUS_MONTHS.map((m) => ({ label: m, value: m }));
  const yearOptions = bonusYearOptions(currentYear, api.values.year).map((y) => ({ label: String(y), value: y }));
  return (
    <>
      <TextField
        label="Bonus (calculated by Basic Salary)"
        required
        value={api.values.percent}
        onChangeText={(text) => {
          const filtered = decimalOnly(text);
          api.setValue('percent', filtered);
          api.setError('percent', livePercentError(filtered));
        }}
        placeholder="Enter percentage"
        rightIcon="percent"
        maxLength={7}
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={api.errors.percent || null}
        editable={!api.disabled}
        testID="field-percent"
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Select<string>
          style={{ flex: 1 }}
          label="Month"
          required
          title="Select Month"
          placeholder="Select Month"
          value={api.values.month === '' ? null : api.values.month}
          options={monthOptions}
          onChange={(month) => {
            api.setValue('month', month);
            api.setError('month', '');
          }}
          error={api.errors.month || null}
          disabled={api.disabled}
          testID="field-month"
        />
        <Select<number>
          style={{ flex: 1 }}
          label="Year"
          required
          title="Select Year"
          placeholder="Select Year"
          value={api.values.year}
          options={yearOptions}
          onChange={(year) => {
            api.setValue('year', year);
            api.setError('year', '');
          }}
          error={api.errors.year || null}
          disabled={api.disabled}
          testID="field-year"
        />
      </View>
    </>
  );
}

/** Bonus ("Bonus N"): percentage of Basic Salary for a month / year; percentages must be unique. */
export const bonusConfig: TemplateTypeConfig<BonusIncentive, BonusFormValues> = {
  kind: 'bonus',
  title: 'Bonus',
  addLabel: 'Add Bonus',
  listLabel: 'All Bonuses',
  icon: 'gift',
  itemTitle: (item, index) => `Bonus ${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Bonus ${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this bonus?',
  renderBadges: (item) => <Badge label={`${formatNumber(item.bonusPercent)}%`} tone="primary" />,
  renderDetails: (item) =>
    item.month && item.year ? (
      <Text variant="callout" color="textSecondary">{`${item.month} ${item.year}`}</Text>
    ) : null,
  messages: INCENTIVE_MESSAGES,
  initialForm: bonusFormFromItem,
  fields: (api) => <BonusFields api={api} />,
  validate: (form, ctx) => validateBonusForm(form, ctx),
  save: async ({ orgId, form, editing, nextName }) => {
    const percent = bonusPercentValue(form);
    const month = form.month;
    const year = form.year as number;
    // v1 sent only the percentage on edit, so month / year edits were silently lost; both are persisted now.
    if (editing) await updateBonusIncentive(editing.id, percent, { month, year });
    else await createBonusIncentive({ orgId, templateName: nextName, bonusPercent: percent, month, year });
  },
  api: incentiveApi('bonus', listBonusIncentives),
  assign: {
    title: 'Staff Details',
    loadWarnIds: async (orgId, items) => [...(await getBonusAssignedUserIds(orgId, items))],
    warnTitle: 'Already Assigned',
    warnMessage: (name) => `${name} is already assigned to a bonus. Do you still want to assign them?`,
  },
};

/* ------------------------------------------------------------------------------------------------ */
/* Count basis                                                                                       */
/* ------------------------------------------------------------------------------------------------ */

const liveNumber = (text: string): string => liveAmountError(text, 'Must be a valid number');

/** Count basis ("Count N"): Count Upto, Next Count and Each Incentive; each value must be unique across templates. */
export const countBasisConfig: TemplateTypeConfig<CountIncentive, CountFormValues> = {
  kind: 'count',
  title: 'Count Basis',
  addLabel: 'Add Count',
  listLabel: 'All Count Basis',
  icon: 'target',
  itemTitle: (item, index) => `Count ${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Count ${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this template?',
  renderBadges: (item) => <Badge label={formatINR(item.eachIncentive)} tone="success" />,
  renderDetails: (item) => (
    <>
      <DetailLine label="Count Upto Basic Salary" value={formatNumber(item.countUpto)} />
      <DetailLine label="Next Count" value={formatNumber(item.nextCount)} />
    </>
  ),
  messages: INCENTIVE_MESSAGES,
  initialForm: countFormFromItem,
  fields: (api) => (
    <>
      <TextField
        label="Count Upto Basic Salary"
        value={api.values.countUpto}
        onChangeText={(text) => {
          api.setValue('countUpto', text);
          api.setError('countUpto', liveWholeNumberError(text));
        }}
        placeholder="Enter count"
        inputMode="numeric"
        keyboardType="number-pad"
        error={api.errors.countUpto || null}
        editable={!api.disabled}
        testID="field-count-upto"
      />
      <TextField
        label="Next Count"
        value={api.values.nextCount}
        onChangeText={(text) => {
          api.setValue('nextCount', text);
          api.setError('nextCount', liveWholeNumberError(text));
        }}
        placeholder="Enter next count"
        inputMode="numeric"
        keyboardType="number-pad"
        error={api.errors.nextCount || null}
        editable={!api.disabled}
        testID="field-next-count"
      />
      <TextField
        label="Each Incentive"
        value={api.values.incentive}
        onChangeText={(text) => {
          api.setValue('incentive', text);
          api.setError('incentive', liveNumber(text));
        }}
        placeholder="Enter incentive amount"
        prefix="₹"
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={api.errors.incentive || null}
        editable={!api.disabled}
        testID="field-incentive"
      />
    </>
  ),
  validate: (form, ctx) => validateCountForm(form, ctx),
  save: async ({ orgId, form, editing, nextName }) => {
    const v = countValues(form);
    if (editing) await updateCountIncentive(editing.id, v);
    else await createCountIncentive({ orgId, templateName: nextName, ...v });
  },
  api: incentiveApi('count', listCountIncentives),
  assign: { title: 'Assign Staff' },
};

/* ------------------------------------------------------------------------------------------------ */
/* Turnover basis                                                                                    */
/* ------------------------------------------------------------------------------------------------ */

/** Turnover basis ("Turnover N"): turnover threshold and incentive percent; turnover amounts must be unique. */
export const turnoverConfig: TemplateTypeConfig<TurnoverIncentive, TurnoverFormValues> = {
  kind: 'turnover',
  title: 'Turnover Basis',
  addLabel: 'Add Turnover',
  listLabel: 'All Turnovers',
  icon: 'trending-up',
  itemTitle: (item, index) => `Turnover ${templateDisplayName(item, index)}`,
  formTitle: (editing, nextName) => `Turnover ${editing ? editing.name : nextName}`,
  deleteConfirm: 'Delete this template?',
  renderBadges: (item) => <Badge label={`${formatNumber(item.incentivePercent)}%`} tone="primary" />,
  renderDetails: (item) => <DetailLine label="Basic Salary" value={formatINR(item.turnoverUpto)} />,
  messages: INCENTIVE_MESSAGES,
  initialForm: turnoverFormFromItem,
  fields: (api) => (
    <>
      <TextField
        label="Turnover Upto Basic Salary"
        value={api.values.turnoverUpto}
        onChangeText={(text) => {
          api.setValue('turnoverUpto', text);
          api.setError('turnoverUpto', liveNumber(text));
        }}
        placeholder="Enter turnover amount"
        prefix="₹"
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={api.errors.turnoverUpto || null}
        editable={!api.disabled}
        testID="field-turnover-upto"
      />
      <TextField
        label="After Target Incentive"
        value={api.values.incentive}
        onChangeText={(text) => {
          api.setValue('incentive', text);
          api.setError('incentive', liveNumber(text));
        }}
        placeholder="Enter incentive percentage"
        rightIcon="percent"
        inputMode="decimal"
        keyboardType="decimal-pad"
        error={api.errors.incentive || null}
        editable={!api.disabled}
        testID="field-turnover-incentive"
      />
    </>
  ),
  validate: (form, ctx) => validateTurnoverForm(form, ctx),
  save: async ({ orgId, form, editing, nextName }) => {
    const v = turnoverValues(form);
    if (editing) await updateTurnoverIncentive(editing.id, { orgId, templateName: editing.name, ...v });
    else await createTurnoverIncentive({ orgId, templateName: nextName, ...v });
  },
  api: incentiveApi('turnover', listTurnoverIncentives),
  assign: { title: 'Assign Staff' },
};
