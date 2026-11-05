import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen, useBreakpoint } from '@/components/layout';
import { Badge, Button, Card, EmptyState, ErrorState, Modal, Reveal, SectionHeader, SkeletonList, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { routes, useAppRouter } from '@/lib/navigation';
import { spacing } from '@/theme';

import { CostBox } from '../components/CostBox';
import { PurchaseUnavailable } from '../components/PurchaseUnavailable';
import { StaffStepper } from '../components/StaffStepper';
import { useBillingState, usePlanCatalogue, useSubscription } from '../hooks/useBillingData';
import { useServerQuote } from '../hooks/useServerQuote';
import { FEATURE_LABELS, planFeatureIds } from '../utils/planState';
import { monthLabel, parsePurchaseMode } from '../utils/pricing';
import { canPurchase } from '../utils/platformPolicy';
import { buildQuote, initialStaffLimit, resolveQuoteSource } from '../utils/quote';
import { withServerQuote } from '../utils/serverQuote';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Upgrade / renew / buy configurator. Route params are only `mode` (`new` | `upgrade` | `renew`) and, for `new`,
 * the `planId` of the chosen tier; everything else is derived from the subscription and plan catalogue (query cache).
 */
export default function UpgradePlanScreen() {
  const router = useAppRouter();
  const { isDesktop } = useBreakpoint();
  const params = useLocalSearchParams<{ mode?: string; planId?: string }>();
  const mode = parsePurchaseMode(params.mode);
  const planIdParam = Number(first(params.planId));
  const planId = Number.isFinite(planIdParam) && planIdParam > 0 ? planIdParam : null;

  const sub = useSubscription();
  const catalogue = usePlanCatalogue();
  const { state, today } = useBillingState();
  const [staffOverride, setStaffOverride] = useState<number | null>(null);

  const source = useMemo(
    () => resolveQuoteSource({ mode, planId, subscription: sub.data, catalogue: catalogue.data ?? [], today }),
    [mode, planId, sub.data, catalogue.data, today],
  );
  const quote = source.ok
    ? buildQuote({
        mode,
        target: source.target,
        current: source.current,
        currentStaff: source.currentStaff,
        staffLimit: staffOverride ?? initialStaffLimit(mode, source.currentStaff),
        today,
        renewStart: source.renewStart,
      })
    : null;

  // The estimate shown here is the server's (`POST /orders/quote`, no coupon: those are applied on the payment summary),
  // the same quote the payment summary uses; the local numbers remain while it loads or when the server has no quote.
  const trialLocked = mode !== 'new' && state === 'trial-active';
  const quoteParams = useMemo(
    () => (quote && quote.canContinue ? { planId: quote.plan.id, staffLimit: quote.chargedStaff, couponCode: null, mode } : null),
    [quote, mode],
  );
  const serverQuote = useServerQuote(quoteParams, canPurchase() && !trialLocked).quote;
  const shownQuote = useMemo(() => (quote && serverQuote ? withServerQuote(quote, serverQuote) : quote), [quote, serverQuote]);

  if (!canPurchase()) return <PurchaseUnavailable title="Plan Status" subscription={sub.data} />;

  const trialBlocked = mode !== 'new' && state === 'trial-active';
  const trialEnd = sub.data?.freeTrialEnd ?? sub.data?.endDate ?? null;

  const needsCatalogue = mode === 'new';
  const loading = sub.isLoading || (needsCatalogue && catalogue.isLoading);
  const loadError = (mode !== 'new' && sub.isError) || (needsCatalogue && catalogue.isError);

  if (trialBlocked) {
    return (
      <Screen title="Upgrade Plan" testID="upgrade-plan-screen">
        <Modal
          visible
          dismissible={false}
          onClose={() => router.back()}
          title="Not Available During Free Trial"
          size="sm"
          footer={
            <View style={{ gap: spacing.sm }}>
              <Button title="Buy a Plan" fullWidth onPress={() => router.replace(routes.admin.billing.overview)} testID="trial-buy" />
              <Button title="Close" variant="ghost" fullWidth onPress={() => router.back()} testID="trial-close" />
            </View>
          }
        >
          <Text color="textSecondary">
            {`This page is locked until your free trial ends${trialEnd ? ` on ${formatDate(trialEnd)}` : ''}. You can upgrade or renew after the trial period.`}
          </Text>
        </Modal>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Upgrade Plan">
        <SkeletonList count={3} />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen title="Upgrade Plan">
        <ErrorState
          message="We could not load your plan details."
          onRetry={() => {
            void sub.refetch();
            void catalogue.refetch();
          }}
        />
      </Screen>
    );
  }

  if (!source.ok || !quote || !shownQuote) {
    return (
      <Screen title="Upgrade Plan">
        <EmptyState
          icon="credit-card"
          title={source.ok === false && source.reason === 'plan-not-found' ? 'Plan not found' : 'Select a plan first'}
          message="Pick a plan from the plan details to continue."
          action={{ label: 'Go to subscription', onPress: () => router.replace(routes.admin.billing.overview) }}
        />
      </Screen>
    );
  }

  const { plan } = shownQuote;
  const planLabel = plan.name.trim();
  const bannerTitle = mode === 'renew' ? `Renewing: ${planLabel}` : mode === 'upgrade' ? `Current Plan: ${planLabel}` : `Upgrading to: ${planLabel}`;
  const bannerBadge = mode === 'renew' ? 'RENEW' : mode === 'upgrade' ? 'ACTIVE' : 'NEW';
  // v1: the "Current: n" part only exists when buying / changing a plan over an existing one (modes B and C never had
  // a current plan name, so their hint is "Min 10 · Unlimited").
  const hint = mode === 'new' && quote.hasCurrentPlan
    ? `Current: ${quote.currentStaff} · Min ${quote.minStaff} · Unlimited`
    : `Min ${quote.minStaff} · Unlimited`;

  const goPay = () => router.push(routes.admin.billing.checkout, { mode, planId: plan.id, staff: quote.staffLimit });

  const left = (
    <Reveal index={0} style={{ flex: isDesktop ? 1 : undefined, gap: spacing.lg, width: '100%' }}>
      {mode === 'new' && quote.hasCurrentPlan ? (
        <Card variant="muted" testID="current-plan-banner">
          <Text variant="bodyStrong">{`Current: ${source.current?.planName?.trim() ?? ''}`}</Text>
          <Text variant="caption" color="textMuted">{`${quote.currentStaff} staff · Valid till ${formatDate(source.current?.validTill)}`}</Text>
        </Card>
      ) : null}

      <Card variant="gradient" testID="plan-banner">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="title3" color="onGradient">
              {bannerTitle}
            </Text>
            <Text variant="callout" color="onGradient" style={{ opacity: 0.9 }}>
              {`Valid till ${formatDate(shownQuote.validTill)} · ${formatINR(plan.amount)}/staff/month`}
            </Text>
          </View>
          <Badge label={bannerBadge} tone="success" />
        </View>
      </Card>

      {mode === 'new' ? (
        <Card>
          <SectionHeader title="Duration" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <View>
              <Text variant="title3">{monthLabel(plan.months)}</Text>
              <Text variant="caption" color="textMuted">
                Selected duration
              </Text>
            </View>
            <Badge label={`${formatINR(plan.amount)} /staff/mo`} tone="primary" />
          </View>
        </Card>
      ) : null}

      <Card testID="upgrade-features-card">
        <SectionHeader title="Features" subtitle="Plan Features" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
          {planFeatureIds(plan.name).map((id) => (
            <Badge key={id} label={FEATURE_LABELS[id]} icon="check" />
          ))}
        </View>
      </Card>
    </Reveal>
  );

  const right = (
    <Reveal index={1} style={{ flex: isDesktop ? 1 : undefined, gap: spacing.lg, width: '100%' }}>
      <Card style={{ gap: spacing.lg }} testID="upgrade-staff-card">
        <SectionHeader title="Staff Limit" subtitle="Staff Capacity" />
        <Text variant="caption" color="textMuted" align="center" testID="staff-hint">
          {hint}
        </Text>
        <StaffStepper value={quote.staffLimit} min={quote.minStaff} onChange={setStaffOverride} />
        <CostBox quote={shownQuote} current={source.current} serverQuote={serverQuote} />
      </Card>
    </Reveal>
  );

  return (
    <Screen
      title="Upgrade Plan"
      testID="upgrade-plan-screen"
      footer={
        <View style={{ gap: spacing.xs }}>
          <Button
            title={quote.canContinue ? 'Continue to Pay' : 'Add Staff to Continue'}
            icon="lock"
            fullWidth
            disabled={!quote.canContinue}
            onPress={goPay}
            testID="continue-pay"
          />
          <Text variant="caption" color="textMuted" align="center">
            Secure payment · Cancel anytime
          </Text>
        </View>
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.xl, alignItems: 'flex-start' }}>
        {left}
        {right}
      </View>
    </Screen>
  );
}
