import React from 'react';
import { View } from 'react-native';

import { BottomSheet, Card, Divider, EmptyState, ErrorState, Skeleton, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { spacing, useTheme } from '@/theme';
import type { PayItem, PayslipPreview } from '@/types/api/payroll';
import type { Advance } from '@/types/api/salaryReports';

import { rupeesInWords } from '../utils/numberToWords';

function PayTable({ title, items, totalLabel, total }: { title: string; items: PayItem[]; totalLabel: string; total: number }) {
  return (
    <Card variant="muted" style={{ gap: spacing.sm }}>
      <Text variant="bodyStrong">{title}</Text>
      {items.map((it, i) => (
        <View key={`${it.name}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="callout" color="textSecondary" style={{ flex: 1 }}>
            {it.name}
          </Text>
          <Text variant="callout">{formatINR(it.amount, { decimals: 2 })}</Text>
        </View>
      ))}
      <Divider />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodyStrong">{totalLabel}</Text>
        <Text variant="bodyStrong">{formatINR(total, { decimals: 2 })}</Text>
      </View>
    </Card>
  );
}

/** Name of the admin who recorded the advance (`created_by_name`; the DTO's `createdBy` is only an id). */
function addedByName(a: Advance): string {
  const v = a.raw.created_by_name;
  return typeof v === 'string' && v.trim() ? v.trim() : '—';
}

export interface PayslipSheetProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  payslip: PayslipPreview | null | undefined;
}

/** The employee's assigned payslip: earnings, deductions, net pay in figures and words. */
export function PayslipSheet({ visible, onClose, loading, error, onRetry, payslip }: PayslipSheetProps) {
  const { colors } = useTheme();
  const info: [string, string][] = payslip
    ? ([
        ['Name', payslip.staffName],
        ['Emp ID', payslip.empId],
        ['Department', payslip.department],
        ['Branch', payslip.branch],
      ] as [string, string][]).filter(([, v]) => !!v)
    : [];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Payslip" snap="tall" testID="payslip-sheet">
      {loading ? (
        <View style={{ gap: spacing.md }} testID="payslip-loading">
          <Skeleton height={22} width="60%" />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </View>
      ) : error ? (
        <ErrorState message="Could not load your payslip." onRetry={onRetry} />
      ) : !payslip ? (
        <EmptyState icon="receipt" title="No payslip assigned yet." compact />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: 2 }}>
            <Text variant="title3">{payslip.orgName}</Text>
            <Text variant="callout" color="textSecondary" testID="payslip-title">
              {`${payslip.payslipName} — ${payslip.month} ${payslip.year}`}
            </Text>
          </View>
          {info.length > 0 ? (
            <Card variant="outlined" style={{ gap: spacing.sm }}>
              {info.map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="callout" color="textSecondary">
                    {k}
                  </Text>
                  <Text variant="callout" weight="semibold">
                    {v}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          <PayTable title="Earnings" items={payslip.earnings} totalLabel="Total Earnings" total={payslip.totalEarnings} />
          <PayTable title="Deductions" items={payslip.deductions} totalLabel="Total Deductions" total={payslip.totalDeductions} />
          <Text variant="callout" color="textSecondary" testID="payslip-words">
            {rupeesInWords(payslip.netPay)}
          </Text>
          <View style={{ padding: spacing.lg, borderRadius: 14, backgroundColor: colors.successSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodyStrong" style={{ color: colors.success }}>
              Net Pay
            </Text>
            <Text variant="title2" style={{ color: colors.success }} testID="payslip-net">
              {formatINR(payslip.netPay, { decimals: 2 })}
            </Text>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

export interface BonusSheetProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  employeeName: string;
  advances: Advance[] | undefined;
}

/** Bonus / advance records: amount, date, who added. */
export function BonusSheet({ visible, onClose, loading, error, onRetry, employeeName, advances }: BonusSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Bonus / Advance" snap="half" testID="bonus-sheet">
      {employeeName ? (
        <Text variant="callout" color="textSecondary" style={{ marginBottom: spacing.md }}>
          {employeeName}
        </Text>
      ) : null}
      {loading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : error ? (
        <ErrorState message="Could not load your records." onRetry={onRetry} />
      ) : !advances || advances.length === 0 ? (
        <EmptyState icon="gift" title="No bonus or advance records yet." compact />
      ) : (
        <View style={{ gap: spacing.md }}>
          {advances.map((a) => (
            <Card key={a.id} variant="outlined" testID="advance-row" style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="title3">{formatINR(a.amount, { decimals: 2 })}</Text>
                <Text variant="callout" color="textSecondary">
                  {formatDate(a.date)}
                </Text>
              </View>
              <Text variant="caption" color="textMuted">{`Added by: ${addedByName(a)}`}</Text>
            </Card>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
