import React from 'react';
import { View } from 'react-native';

import { Card, Divider, Spinner, Text } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { spacing } from '@/theme';
import type { Coupon } from '@/types/api/billing';

import { FEATURE_LABELS, planFeatureIds } from '../utils/planState';
import { GST_RATE, type Totals } from '../utils/pricing';
import type { Quote } from '../utils/quote';

function Row({
  label,
  sub,
  value,
  tone,
  strong,
  testID,
  loading,
}: {
  label: string;
  sub?: string;
  value: string;
  tone?: 'success' | 'muted';
  strong?: boolean;
  testID?: string;
  /** Small spinner + dimmed value while the server quote is on its way. */
  loading?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Text variant={strong ? 'title3' : 'body'} weight={strong ? 'bold' : undefined}>
          {label}
        </Text>
        {sub ? (
          <Text variant="caption" color="textMuted">
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {loading ? <Spinner size="small" testID="total-loading" /> : null}
        <Text variant={strong ? 'title3' : 'bodyStrong'} color={tone === 'success' ? 'success' : tone === 'muted' ? 'textSecondary' : 'text'} style={loading ? { opacity: 0.5 } : undefined} testID={testID}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export type PriceBreakdownProps = {
  quote: Quote;
  totals: Totals;
  coupon: Coupon | null;
  /** Coupon input / applied badge (hidden for capacity upgrades by the screen). */
  couponSlot?: React.ReactNode;
  footer?: React.ReactNode;
  /** Replaces the percent label of the coupon row (flat / capped coupons priced by the server). */
  discountLabel?: string;
  /** The server quote is loading: the grand total shows a spinner (the rest keeps its numbers). */
  totalLoading?: boolean;
};

/** Staff charge → credit → coupon → subtotal → GST → grand total, exactly as the pricing rules compute them. */
export function PriceBreakdown({ quote, totals, coupon, couponSlot, footer, discountLabel, totalLoading }: PriceBreakdownProps) {
  const { plan } = quote;
  const staffSub = quote.isStaffUpgrade
    ? `${quote.chargedStaff} extra staff × ${formatINR(plan.amount)}/staff × ${quote.chargedMonths} months`
    : `${quote.chargedStaff} staff × ${formatINR(plan.amount)}/staff × ${quote.chargedMonths} months`;

  return (
    <Card style={{ gap: spacing.lg }} testID="price-breakdown">
      <Text variant="title3">Price Breakdown</Text>
      <Row label="Staff Charges" sub={staffSub} value={formatINR(totals.staffCharge)} testID="row-staff-charge" />
      {planFeatureIds(plan.name).map((id) => (
        <Row key={id} label={FEATURE_LABELS[id]} sub="Included in plan" value="Included" tone="muted" />
      ))}
      {quote.credit > 0 ? (
        <Row label="Plan Upgrade Credit" sub="Unused value of current plan" value={`− ${formatINR(quote.credit)}`} tone="success" testID="row-credit" />
      ) : null}
      {couponSlot}
      {coupon && !quote.noCoupon ? (
        <Row
          label={discountLabel ?? `Coupon Discount (${totals.discountPercent}% on ${formatINR(totals.afterCredit)})`}
          value={`- ${formatINR(totals.discountAmount)}`}
          tone="success"
          testID="row-discount"
        />
      ) : null}
      <Divider />
      <Row label="Subtotal" value={formatINR(totals.subtotal)} testID="row-subtotal" />
      <Row label={`GST (${Math.round(GST_RATE * 100)}%)`} sub="Goods & Services Tax" value={formatINR(totals.gst)} testID="row-gst" />
      <Row label="Grand Total" sub="Inclusive of all taxes" value={formatINR(totals.grandTotal)} strong testID="row-grand-total" loading={totalLoading} />
      {footer}
    </Card>
  );
}
