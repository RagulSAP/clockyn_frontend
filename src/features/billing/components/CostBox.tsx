import React from 'react';
import { View } from 'react-native';

import { Card, Divider, Text } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { spacing } from '@/theme';

import { CREDIT_BASELINE_STAFF } from '../utils/pricing';
import type { OrderQuote } from '@/types/api/billing';

import type { CurrentPlanInfo, Quote } from '../utils/quote';

function Line({ label, formula, value, tone, strong }: { label: string; formula?: string; value: string; tone?: 'success'; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ flex: 1 }}>
        <Text variant="callout" color="textSecondary">
          {label}
        </Text>
        {formula ? (
          <Text variant="caption" color="textMuted">
            {formula}
          </Text>
        ) : null}
      </View>
      <Text variant={strong ? 'title2' : 'bodyStrong'} color={tone === 'success' ? 'success' : 'text'}>
        {value}
      </Text>
    </View>
  );
}

/** Price preview under the staff stepper (before coupon and GST; those are on the payment summary). */
export function CostBox({ quote, current, serverQuote }: { quote: Quote; current: CurrentPlanInfo | null; serverQuote?: OrderQuote | null }) {
  const P = quote.plan.amount;

  if (quote.mode === 'upgrade') {
    if (quote.extraStaff === 0) {
      return (
        <Card variant="muted" testID="cost-box">
          <Text variant="callout" color="textSecondary">{`Increase staff count above ${quote.currentStaff} to add more`}</Text>
        </Card>
      );
    }
    const value = serverQuote ? serverQuote.staffCharge : quote.extraStaff * P * quote.chargedMonths;
    return (
      <Card variant="muted" testID="cost-box">
        <Text variant="callout" color="textSecondary">
          {`+${quote.extraStaff} new staff × ${formatINR(P)}/staff × ${quote.chargedMonths} months = ${formatINR(value)}`}
        </Text>
      </Card>
    );
  }

  const cost = serverQuote ? serverQuote.staffCharge : quote.staffLimit * P * quote.chargedMonths;
  const youPay = serverQuote ? serverQuote.afterCredit : Math.max(0, cost - quote.credit);
  const formula = `${quote.staffLimit} × ${formatINR(P)} × ${quote.chargedMonths}m = ${formatINR(cost)}`;

  if (quote.mode === 'renew' || !quote.hasCurrentPlan) {
    return (
      <Card variant="muted" testID="cost-box">
        <Line label={quote.mode === 'renew' ? 'Renewal cost' : 'New plan cost'} formula={formula} value={formatINR(cost)} />
      </Card>
    );
  }

  const creditFormula =
    quote.credit > 0 ? `− ${CREDIT_BASELINE_STAFF} × ${formatINR(current?.amount ?? 0)} × ${current?.months ?? 1}m = ${formatINR(quote.credit)}` : undefined;
  return (
    <Card variant="muted" testID="cost-box" style={{ gap: spacing.md }}>
      <Line label="New plan cost" formula={formula} value={formatINR(cost)} />
      <Line label="Credit (current plan)" formula={creditFormula} value={quote.credit > 0 ? `− ${formatINR(quote.credit)}` : formatINR(0)} tone="success" />
      <Divider />
      <Line label="You pay" value={formatINR(youPay)} strong />
    </Card>
  );
}
