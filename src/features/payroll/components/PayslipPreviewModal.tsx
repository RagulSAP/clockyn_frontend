import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { radii, spacing, useTheme } from '@/theme';
import { Button, Card, Divider, ErrorState, Modal, SkeletonList, Text } from '@/components/ui';
import { getPayslipPreview } from '@/api/payroll';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/query/queryKeys';
import type { PayItem } from '@/types/api/payroll';
import { rupeesInWords } from '../utils/numberToWords';

export interface PayslipPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  orgId: string;
  payslipId: string | null;
  staffId: string | null;
}

const money = (n: number) => formatINR(n, { decimals: 2 });

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <Text variant="callout" color="textSecondary" style={{ width: 110 }}>
        {label}
      </Text>
      <Text variant="callout" weight="semibold" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function AmountTable({ title, items, totalLabel, total }: { title: string; items: PayItem[]; totalLabel: string; total: number }) {
  const { colors } = useTheme();
  return (
    <Card variant="outlined" padding={spacing.md} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="bodyStrong">Amount</Text>
      </View>
      <Divider />
      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="callout" style={{ flex: 1 }}>
            {item.name}
          </Text>
          <Text variant="callout">{money(item.amount)}</Text>
        </View>
      ))}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingTop: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text variant="bodyStrong">{totalLabel}</Text>
        <Text variant="bodyStrong">{money(total)}</Text>
      </View>
    </Card>
  );
}

/** What one staff member's payslip would look like under a template (server month / year). */
export function PayslipPreviewModal({ visible, onClose, orgId, payslipId, staffId }: PayslipPreviewModalProps) {
  const { colors } = useTheme();
  const enabled = visible && !!orgId && !!payslipId && !!staffId;
  const query = useQuery({
    queryKey: queryKeys.payroll.preview(orgId, staffId ?? '', { payslipId }),
    queryFn: () => getPayslipPreview(orgId, staffId as string, payslipId as string),
    enabled,
  });
  const data = query.data;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Payslip preview"
      size="md"
      testID="payslip-preview"
      footer={<Button title="Close" variant="secondary" fullWidth onPress={onClose} />}
    >
      {query.isLoading ? <SkeletonList count={4} /> : null}
      {!query.isLoading && query.isError ? <ErrorState message="Failed to load preview" onRetry={() => void query.refetch()} compact /> : null}
      {data ? (
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="title3">{data.orgName}</Text>
            <Text variant="callout" color="textSecondary">{`${data.payslipName} - ${data.month} ${data.year}`}</Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            <InfoRow label="Name:" value={data.staffName} />
            <InfoRow label="Emp ID:" value={data.empId} />
            <InfoRow label="Department:" value={data.department} />
            <InfoRow label="Branch:" value={data.branch} />
            <InfoRow label="Account No:" value={data.accountNumber || 'N/A'} />
            <InfoRow label="IFSC Code:" value={data.ifscCode || 'N/A'} />
          </View>
          <AmountTable title="Earnings" items={data.earnings} totalLabel="Total Earnings" total={data.totalEarnings} />
          <AmountTable title="Deductions" items={data.deductions} totalLabel="Total Deductions" total={data.totalDeductions} />
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" color="textSecondary">
              {rupeesInWords(data.netPay)}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: spacing.lg,
                borderRadius: radii.md,
                backgroundColor: colors.successSoft,
              }}
            >
              <Text variant="bodyStrong" color="success">
                Net Pay
              </Text>
              <Text variant="title2" color="success" testID="preview-net-pay">
                {money(data.netPay)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
