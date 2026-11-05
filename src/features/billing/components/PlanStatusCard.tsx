import React from 'react';
import { View } from 'react-native';

import { Badge, Card, ProgressRing, Text } from '@/components/ui';
import { withAlpha } from '@/components/ui/internal/color';
import { formatDate } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { Subscription } from '@/types/api/plans';

import { BILLING_BADGE, BILLING_TONE, billingSentence, remainingStaff, type BillingState } from '../utils/planState';

export type PlanStatusCardProps = {
  subscription: Subscription | null | undefined;
  state: BillingState;
  usedStaff: number;
  /** iOS view-only card: the compact v1 wording ("{n} staff accounts", "Used", no billing dates). */
  readOnly?: boolean;
};

function Meta({ label, value, danger, inline }: { label: string; value: string; danger?: boolean; inline?: boolean }) {
  if (inline) {
    // Label left, figure right: the compact list that sits beside the usage ring.
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="caption" color="onGradient" style={{ opacity: 0.8 }}>
          {label}
        </Text>
        <Text variant="title3" color={danger ? 'dangerSoft' : 'onGradient'} testID={`meta-${label}`}>
          {value}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" color="onGradient" style={{ opacity: 0.8 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" color={danger ? 'dangerSoft' : 'onGradient'} testID={`meta-${label}`}>
        {value}
      </Text>
    </View>
  );
}

/** iOS sentence under the plan name (v1: trial end / "Valid till … · n staff accounts" / "No active plan"). */
function readOnlySentence(state: BillingState, trialEnd: string, validTill: string, staffLimit: number | null | undefined): string {
  if (state === 'trial-active') return `Free trial ends on ${trialEnd}`;
  if (state === 'paid-active') return `Valid till ${validTill} · ${staffLimit ?? 0} staff accounts`;
  return 'No active plan';
}

/** Plan name, status, validity and staff capacity of the organisation. */
export function PlanStatusCard({ subscription, state, usedStaff, readOnly = false }: PlanStatusCardProps) {
  const { colors } = useTheme();
  const planName = subscription?.planName?.trim() || 'No Active Plan';
  const trialEnd = formatDate(subscription?.freeTrialEnd ?? subscription?.endDate);
  const remaining = remainingStaff(subscription?.staffLimit, usedStaff);
  const limit = subscription?.staffLimit ?? 0;
  const usedShare = limit > 0 ? Math.min(1, Math.max(0, usedStaff / limit)) : 0;
  const full = remaining === 0;
  const showStaff = state !== 'none' && !!subscription;
  const sentence = readOnly ? readOnlySentence(state, trialEnd, formatDate(subscription?.endDate), subscription?.staffLimit) : billingSentence(state, trialEnd);

  return (
    <Card variant="gradient" padding={spacing.xl} testID="plan-status-card">
      <View style={{ gap: spacing.md }}>
        <Badge label={BILLING_BADGE[state]} tone={BILLING_TONE[state]} icon={state === 'trial-active' ? 'star' : undefined} testID="plan-state-badge" />
        <Text variant="title1" color="onGradient" testID="plan-name">
          {planName}
        </Text>
        <Text variant="body" color="onGradient" style={{ opacity: 0.9 }} testID="plan-sentence">
          {sentence}
        </Text>
        <View style={{ height: 1, backgroundColor: colors.onGradient, opacity: 0.2 }} />
        {readOnly ? null : (
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Meta label="Billing Date" value={formatDate(subscription?.startDate ?? subscription?.billingDate)} />
            <Meta label="Valid Until" value={formatDate(subscription?.endDate)} />
          </View>
        )}
        {showStaff ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.md, borderRadius: radii.md, overflow: 'hidden' }}>
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.onGradient, opacity: 0.14 }}
              />
              {limit > 0 ? (
                // Used-vs-limit ring (same sweep as the home page rings); the figures stay in the list beside it.
                <View accessible={false} testID="staff-usage-ring">
                  <ProgressRing progress={usedShare} color={full ? colors.dangerSoft : colors.onGradient} track={withAlpha(colors.onGradient, 0.2)} size={84} stroke={8}>
                    <Text variant="title3" color={full ? 'dangerSoft' : 'onGradient'}>
                      {`${Math.round(usedShare * 100)}%`}
                    </Text>
                  </ProgressRing>
                </View>
              ) : null}
              <View style={{ flex: 1, gap: spacing.sm }}>
                <Meta inline label="Staff Limit" value={String(subscription?.staffLimit ?? 0)} />
                <Meta inline label={readOnly ? 'Used' : 'Used Staff'} value={String(usedStaff)} />
                <Meta inline label="Remaining" value={String(remaining)} danger={remaining === 0} />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
