import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { markSalaryPaid } from '@/api/salaryReports';
import { ResponsiveRow, Screen } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CheckboxMark,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  MonthYearPicker,
  SkeletonList,
  StatCard,
  Text,
  useConfirm,
} from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { currentMonthIST, formatMonthYear, monthKey } from '@/lib/datetime';
import { getErrorMessage } from '@/lib/api/errors';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import { ReportBanner } from '../components/ReportBanner';
import { usePaySheet } from '../hooks/useReportQueries';
import { yearRangeFor } from '../utils/monthRange';
import { allUnpaidSelected, computePayTotals, isPaid, pruneSelection, unpaidIds, type PayRow } from '../utils/monthlySalary';

const NONE: ReadonlySet<string> = new Set();
const AMOUNT_PLACEHOLDER = '₹—';

function PayCard({
  row,
  paid,
  selected,
  busy,
  onToggle,
  onPay,
}: {
  row: PayRow;
  paid: boolean;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onPay: () => void;
}) {
  const { colors } = useTheme();
  const sub = [row.empId, row.dept].filter(Boolean).join('  •  ');
  return (
    <Card
      padding={spacing.md}
      variant="outlined"
      onPress={paid ? undefined : onToggle}
      accessibilityLabel={`${row.name}, ${paid ? 'paid' : 'unpaid'}`}
      testID={`pay-row-${row.userId}`}
      style={{ borderColor: paid ? colors.success : selected ? colors.primary : colors.border }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        {paid ? (
          <View style={{ width: 22, height: 22, borderRadius: radii.xs, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={14} color="onPrimary" strokeWidth={3} />
          </View>
        ) : (
          <CheckboxMark checked={selected} />
        )}
        <Avatar uri={row.photoUrl} name={row.name} size={42} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {row.name}
          </Text>
          {sub ? (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
          {row.net !== null ? (
            <Text variant="caption" color="textSecondary">
              {formatINR(row.net)}
            </Text>
          ) : null}
        </View>
        {!row.isActive ? <Badge label="Inactive" tone="neutral" size="sm" /> : null}
        {paid ? (
          <Badge label="Paid" tone="success" icon="check" />
        ) : (
          <Button title="Pay" size="sm" variant="secondary" disabled={busy} onPress={onPay} testID={`pay-${row.userId}`} />
        )}
      </View>
    </Card>
  );
}

export default function MonthlySalaryScreen() {
  const { colors } = useTheme();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [{ year, month }, setPeriod] = useState(() => currentMonthIST());
  const periodKey = monthKey(year, month);
  const sheet = usePaySheet(year, month);

  // Local paid marks and the selection belong to ONE period: they are ignored as soon as month/year changes (v1 kept them).
  const [paidState, setPaidState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: periodKey, ids: NONE });
  const [selState, setSelState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: periodKey, ids: NONE });
  const [successLabel, setSuccessLabel] = useState<string | null>(null);
  const localPaid = paidState.key === periodKey ? paidState.ids : NONE;
  const selected = selState.key === periodKey ? selState.ids : NONE;

  const rows = useMemo(() => sheet.data?.rows ?? [], [sheet.data]);
  const totals = useMemo(() => computePayTotals(rows, localPaid, sheet.data?.amountsAvailable ?? false), [rows, localPaid, sheet.data?.amountsAvailable]);
  const label = formatMonthYear(year, month);
  const allSelected = allUnpaidSelected(rows, localPaid, selected);

  const { run: pay, loading: paying } = useAsyncAction(
    async (ids: string[]) => {
      await markSalaryPaid({ orgId, userIds: ids, month, year });
      return { ids, key: periodKey, label };
    },
    {
      errorMessage: 'Failed to process payment',
      onSuccess: ({ ids, key, label: paidLabel }) => {
        setPaidState((prev) => ({ key, ids: new Set([...(prev.key === key ? prev.ids : NONE), ...ids]) }));
        setSelState((prev) => (prev.key === key ? { key, ids: new Set([...prev.ids].filter((id) => !ids.includes(id))) } : prev));
        setSuccessLabel(paidLabel);
        void queryClient.invalidateQueries({ queryKey: queryKeys.salaryReports.monthly(orgId, year, month) });
      },
    },
  );

  const toggleOne = useCallback(
    (id: string) =>
      setSelState((prev) => {
        const base = prev.key === periodKey ? prev.ids : NONE;
        const next = new Set(base);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { key: periodKey, ids: pruneSelection(next, rows, localPaid) };
      }),
    [periodKey, rows, localPaid],
  );

  const toggleAll = () => setSelState({ key: periodKey, ids: allSelected ? NONE : new Set(unpaidIds(rows, localPaid)) });

  const payMany = async (ids: string[], what: string): Promise<void> => {
    if (ids.length === 0) return;
    const ok = await confirm({
      title: 'Mark salaries as paid?',
      message: `${what} will be marked as paid for ${label}.`,
      confirmText: 'Mark as paid',
    });
    if (ok) await pay(ids);
  };

  const unpaid = unpaidIds(rows, localPaid);
  const selectedIds = [...selected];

  const money = (v: number | null) => (v === null ? AMOUNT_PLACEHOLDER : formatINR(v));

  return (
    <Screen title="Monthly Salary" testID="monthly-salary" maxWidth={1120}>
      <View style={{ gap: spacing.lg }}>
        <Card padding={spacing.md}>
          <MonthYearPicker month={month} year={year} onChange={setPeriod} yearRange={yearRangeFor('reports')} testID="salary-month" />
        </Card>

        {!orgId ? (
          <EmptyState icon="lock" title="Session unavailable" message="Sign in again to manage salaries." />
        ) : sheet.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="callout" color="textSecondary" align="center">
              Loading employees...
            </Text>
            <SkeletonList count={5} />
          </View>
        ) : sheet.isError || !sheet.data ? (
          <ErrorState message={getErrorMessage(sheet.error, 'Failed to load staff')} onRetry={() => void sheet.refetch()} />
        ) : (
          <>
            {!sheet.data.paidFromServer ? (
              <ReportBanner tone="info" message="Paid marks are kept on this screen only until the server reports payment status; reopening the screen starts unpaid again." />
            ) : null}
            <ResponsiveRow columns={{ phone: 2, tablet: 3, desktop: 5 }} gap={spacing.md}>
              <StatCard label="Total" value={totals.total} icon="users" tone="primary" />
              <StatCard label="Paid" value={totals.paid} icon="check-circle" tone="success" />
              <StatCard label="Unpaid" value={totals.unpaid} icon="hourglass" tone="warning" />
              <StatCard label="Total Amt" value={money(totals.totalAmount)} icon="wallet" tone="primary" />
              <StatCard label="Unpaid Amt" value={money(totals.unpaidAmount)} icon="rupee" tone="danger" />
            </ResponsiveRow>

            {rows.length > 0 ? (
              <Card padding={spacing.lg}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                  <Text variant="callout" weight="semibold">{`Payment Progress — ${label}`}</Text>
                  <Text variant="callout" weight="bold" color="primary">{`${totals.paidPct}%`}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
                  <View testID="pay-progress" style={{ width: `${totals.paidPct}%`, height: 8, backgroundColor: colors.primary }} />
                </View>
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
              <Card
                variant="muted"
                padding={spacing.md}
                onPress={unpaid.length > 0 ? toggleAll : undefined}
                accessibilityLabel={`Select all ${unpaid.length}`}
                testID="select-all"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <CheckboxMark checked={allSelected} disabled={unpaid.length === 0} />
                  <Text variant="callout" weight="semibold">{`Select All (${unpaid.length})`}</Text>
                </View>
              </Card>
              {selectedIds.length > 0 ? (
                <Button
                  title={`Pay Selected (${selectedIds.length})`}
                  icon="check"
                  loading={paying}
                  disabled={paying}
                  onPress={() => void payMany(selectedIds, `${selectedIds.length} selected employee${selectedIds.length === 1 ? '' : 's'}`)}
                  testID="pay-selected"
                />
              ) : (
                <Button
                  title={`Pay All (${unpaid.length})`}
                  icon="check-check"
                  loading={paying}
                  disabled={paying || unpaid.length === 0}
                  onPress={() => void payMany(unpaid, `All ${unpaid.length} unpaid employee${unpaid.length === 1 ? '' : 's'}`)}
                  testID="pay-all"
                />
              )}
            </View>

            {rows.length === 0 ? (
              <EmptyState icon="users" title="No employees found" />
            ) : (
              <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.md}>
                {rows.map((r) => (
                  <PayCard
                    key={r.userId}
                    row={r}
                    paid={isPaid(r, localPaid)}
                    selected={selected.has(r.userId)}
                    busy={paying}
                    onToggle={() => toggleOne(r.userId)}
                    onPay={() => void pay([r.userId])}
                  />
                ))}
              </ResponsiveRow>
            )}
          </>
        )}
      </View>

      <Modal
        visible={successLabel !== null}
        onClose={() => setSuccessLabel(null)}
        title="Payment Processed!"
        size="sm"
        footer={<Button title="Done" fullWidth onPress={() => setSuccessLabel(null)} testID="success-done" />}
      >
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color="success" strokeWidth={3} />
          </View>
          <Text align="center" color="textSecondary">
            {`Salary for ${successLabel ?? ''} has been marked as paid successfully.`}
          </Text>
        </View>
      </Modal>
    </Screen>
  );
}
