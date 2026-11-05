import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { spacing } from '@/theme';
import { Button, Card, EmptyState, ErrorState, SkeletonList, Text, TextField, useToast } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { useAsyncAction } from '@/hooks';
import { savePayslipTemplate } from '@/api/payroll';
import { formatINR } from '@/lib/format';
import { routes, useAppRouter } from '@/lib/navigation';
import { queryKeys } from '@/lib/query/queryKeys';
import { CustomLinesEditor } from '../components/CustomLinesEditor';
import { usePayslipTemplates } from '../hooks/usePayslipTemplates';
import {
  buildPayslipInput,
  computeLiveTotals,
  emptyPayslipForm,
  payslipFormFromTemplate,
  validatePayslipForm,
  type CustomLine,
  type FixedAmountField,
  type PayslipFormValues,
} from '../utils/payslipForm';

/** Time the saved confirmation stays visible before returning to the list (v1: 1.5 s). */
const SAVED_DELAY_MS = 1500;

function AmountField({
  label,
  field,
  values,
  errors,
  disabled,
  required,
  onChange,
}: {
  label: string;
  field: FixedAmountField;
  values: PayslipFormValues;
  errors: Record<string, string>;
  disabled: boolean;
  required?: boolean;
  onChange: (field: FixedAmountField, text: string) => void;
}) {
  return (
    <TextField
      label={label}
      required={required}
      value={values[field]}
      onChangeText={(text) => onChange(field, text)}
      placeholder="0"
      prefix="₹"
      inputMode="decimal"
      keyboardType="decimal-pad"
      error={errors[field] || null}
      editable={!disabled}
      testID={`payslip-${field}`}
    />
  );
}

/** Add / edit a monthly-fixed payslip template (`templateId` param = edit) with live decimal-safe totals. */
export default function PayslipEditScreen() {
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const editId = typeof templateId === 'string' && templateId !== '' ? templateId : null;
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { orgId, query, templates } = usePayslipTemplates();

  const existing = useMemo(() => (editId ? (templates.find((t) => t.id === editId) ?? null) : null), [editId, templates]);
  const [values, setValues] = useState<PayslipFormValues>(emptyPayslipForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const prefilled = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefill once per template (never overwrite what the user is typing when the list refetches).
  useEffect(() => {
    if (existing && prefilled.current !== existing.id) {
      prefilled.current = existing.id;
      setValues(payslipFormFromTemplate(existing));
    }
  }, [existing]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const totals = useMemo(() => computeLiveTotals(values), [values]);

  const saveAction = useAsyncAction(() => savePayslipTemplate(buildPayslipInput(orgId, values), editId ?? undefined), {
    errorMessage: 'Failed to save template',
    onSuccess: () => {
      toast.success(editId ? 'Payslip Updated!' : 'Payslip Added!');
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all(orgId) });
      timer.current = setTimeout(() => router.backOr(routes.admin.payroll.payslips), SAVED_DELAY_MS);
    },
  });

  const setField = (field: FixedAmountField, text: string) => {
    setValues((prev) => ({ ...prev, [field]: text }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  };

  /** Updates a custom-row list and clears the inline error of every row whose amount was edited. */
  const setLines = (kind: 'earnings' | 'deductions', lines: CustomLine[]) => {
    setValues((prev) => ({ ...prev, [kind]: lines }));
    setErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const line of lines) {
        const key = `${kind}:${line.id}`;
        const before = values[kind].find((l) => l.id === line.id);
        if (next[key] && before && before.amount !== line.amount) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const submit = () => {
    const result = validatePayslipForm(values);
    setErrors(result.fields);
    if (result.message) {
      toast.error(result.message);
      return;
    }
    void saveAction.run();
  };

  const busy = saveAction.loading || saved;
  const waitingForTemplate = editId !== null && existing === null;
  const title = editId ? 'Edit Payslip' : 'Add Payslip';

  if (waitingForTemplate) {
    return (
      <Screen title={title} large testID="payroll-payslip-edit">
        {query.isLoading ? <SkeletonList count={3} /> : null}
        {!query.isLoading && query.isError ? <ErrorState message="Failed to load templates" onRetry={() => void query.refetch()} /> : null}
        {!query.isLoading && !query.isError ? (
          <EmptyState icon="file-text" title="Payslip not found" message="This template may have been deleted." />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      title={title}
      large
      testID="payroll-payslip-edit"
      footer={
        <Button
          title={saveAction.loading ? 'Saving...' : editId ? 'Update Payslip' : 'Save Payslip'}
          icon="check"
          fullWidth
          loading={saveAction.loading}
          disabled={busy}
          onPress={submit}
          testID="payslip-save"
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Card style={{ gap: spacing.md }}>
          <TextField
            label="Payslip Name"
            required
            value={values.name}
            onChangeText={(name) => setValues((prev) => ({ ...prev, name }))}
            placeholder="Enter Payslip Name"
            editable={!busy}
            testID="payslip-name"
          />
        </Card>

        <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }}>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title3">Earnings</Text>
              <Text variant="title3" color="primary" testID="total-earnings">
                {formatINR(totals.totalEarnings)}
              </Text>
            </View>
            <AmountField label="Basic Salary" field="basic" required values={values} errors={errors} disabled={busy} onChange={setField} />
            <AmountField label="House Rent Allowance" field="hra" required values={values} errors={errors} disabled={busy} onChange={setField} />
            <CustomLinesEditor
              lines={values.earnings}
              onChange={(lines) => setLines('earnings', lines)}
              namePlaceholder="Earning name"
              addLabel="Add Earning"
              errors={lineErrors(errors, 'earnings')}
              disabled={busy}
              testIDPrefix="earning"
            />
          </Card>

          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title3">Deductions</Text>
              <Text variant="title3" color="danger" testID="total-deductions">
                {formatINR(totals.totalDeductions)}
              </Text>
            </View>
            <AmountField label="EPF" field="epf" values={values} errors={errors} disabled={busy} onChange={setField} />
            <AmountField label="Professional Tax" field="professionalTax" values={values} errors={errors} disabled={busy} onChange={setField} />
            <AmountField label="Health Insurance" field="healthInsurance" values={values} errors={errors} disabled={busy} onChange={setField} />
            <CustomLinesEditor
              lines={values.deductions}
              onChange={(lines) => setLines('deductions', lines)}
              namePlaceholder="Deduction name"
              addLabel="Add Deduction"
              errors={lineErrors(errors, 'deductions')}
              disabled={busy}
              testIDPrefix="deduction"
            />
          </Card>
        </ResponsiveRow>

        <Card variant="gradient" padding={spacing.xl}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="title3" color="onGradient">
              Net Salary
            </Text>
            <Text variant="title1" color="onGradient" testID="net-salary">
              {formatINR(totals.netSalary)}
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

/** `earnings:<id>` -> `<id>` map for one editor. */
function lineErrors(errors: Record<string, string>, prefix: 'earnings' | 'deductions'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith(`${prefix}:`) && message) out[key.slice(prefix.length + 1)] = message;
  }
  return out;
}
