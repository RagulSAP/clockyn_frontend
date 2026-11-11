import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { billingApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, LoadingOverlay, Modal, Reveal, SkeletonList, Text, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { routes, useAppRouter } from '@/lib/navigation';
import { logEvent } from '@/lib/platform/analytics';
import { openCheckout } from '@/lib/platform/payment';
import { queryKeys } from '@/lib/query/queryKeys';
import { patchSession, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { CouponSection } from '../components/CouponSection';
import { ReferralRewardCard } from '../components/ReferralRewardCard';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { PurchaseUnavailable } from '../components/PurchaseUnavailable';
import { useCoupon } from '../hooks/useCoupon';
import { useReferralReward } from '../hooks/useReferralReward';
import { useServerQuote } from '../hooks/useServerQuote';
import { useBillingState, usePlanCatalogue, useSubscription } from '../hooks/useBillingData';
import {
  runCheckout,
  verifyPending,
  type CheckoutDeps,
  type CheckoutOutcome,
  type PendingVerification,
} from '../utils/checkoutFlow';
import { capitalize, planFeatureIds } from '../utils/planState';
import { calcTotals, parsePurchaseMode } from '../utils/pricing';
import { canPurchase } from '../utils/platformPolicy';
import { isReferralOrderError, referralRefusal } from '../utils/referral';
import { buildQuote, initialStaffLimit, resolveQuoteSource } from '../utils/quote';
import { quoteBadgeLabel, quoteDiscountLabel, quoteNotice, quoteReferralLabel, quoteReferralPercent, quoteToTotals, withServerQuote } from '../utils/serverQuote';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

type Stage = 'idle' | 'processing' | 'verifying';

const MODE_BADGE = { new: 'NEW PLAN', upgrade: 'ADD STAFF', renew: 'RENEWING' } as const;

/** Payment summary + checkout. Route params: `mode`, `planId` (new purchases) and `staff` (the stepper value). */
export default function CheckoutScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const session = useSession();
  const { isDesktop } = useBreakpoint();
  const params = useLocalSearchParams<{ mode?: string; planId?: string; staff?: string }>();
  const mode = parsePurchaseMode(params.mode);
  const planIdParam = Number(first(params.planId));
  const planId = Number.isFinite(planIdParam) && planIdParam > 0 ? planIdParam : null;
  const staffParam = parseInt(first(params.staff) ?? '', 10);

  const sub = useSubscription();
  const catalogue = usePlanCatalogue();
  const { today } = useBillingState();

  const [stage, setStage] = useState<Stage>('idle');
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

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
        staffLimit: Number.isFinite(staffParam) && staffParam > 0 ? staffParam : initialStaffLimit(mode, source.currentStaff),
        today,
        renewStart: source.renewStart,
      })
    : null;

  const noCoupon = quote?.noCoupon ?? mode === 'upgrade';
  const couponState = useCoupon(!noCoupon && canPurchase());
  const localTotals = useMemo(
    () =>
      quote
        ? calcTotals({
            staff: quote.chargedStaff,
            price: quote.plan.amount,
            months: quote.chargedMonths,
            credit: quote.credit,
            couponPercent: couponState.coupon?.discountPercent ?? 0,
          })
        : null,
    [quote, couponState.coupon],
  );

  // The server prices the order: when `POST /orders/quote` answers, its breakdown replaces the local numbers (flat /
  // capped / minimum-amount coupons, referral reward); without an answer (older server, network) the local numbers stay.
  // A referral reward and a coupon exclude each other: `referral.applyReferral` is false while a coupon is applied.
  const couponName = couponState.coupon?.name ?? null;
  const referral = useReferralReward({
    enabled: !noCoupon && canPurchase(),
    hasCoupon: couponName !== null,
    clearCoupon: couponState.remove,
  });
  const applyReferral = referral.applyReferral;
  const quoteParams = useMemo(
    () => (quote ? { planId: quote.plan.id, staffLimit: quote.chargedStaff, couponCode: couponName, mode, applyReferral } : null),
    [quote, couponName, mode, applyReferral],
  );
  const serverQuote = useServerQuote(quoteParams, canPurchase());
  const sq = serverQuote.quote;
  const { observeQuote } = referral;
  useEffect(() => observeQuote(sq), [sq, observeQuote]);
  const totals = useMemo(() => (sq && localTotals ? quoteToTotals(sq) : localTotals), [sq, localTotals]);
  const shownQuote = useMemo(() => (quote && sq ? withServerQuote(quote, sq) : quote), [quote, sq]);

  const onPaid = useCallback(
    (planIdPaid: number) => {
      if (!session) return;
      const orgId = session.orgId;
      void queryClient.invalidateQueries({ queryKey: queryKeys.plans.all(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.staff.count(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all(orgId) });
      patchSession({ planId: planIdPaid, isFreeTrial: false, freeTrialEnd: null });
      logEvent('Subscribe');
      setPending(null);
      setSuccessOpen(true);
    },
    [queryClient, session],
  );

  const handleOutcome = useCallback(
    async (outcome: CheckoutOutcome, planIdPaid: number) => {
      switch (outcome.kind) {
        case 'success':
          onPaid(outcome.payment.planId ?? planIdPaid);
          return;
        case 'dismissed':
          await confirm({ title: 'Payment Cancelled', message: 'You closed the payment window.', confirmText: 'OK', hideCancel: true });
          return;
        case 'failed':
          await confirm({ title: 'Payment Cancelled', message: outcome.message, confirmText: 'OK', hideCancel: true });
          return;
        case 'verify-failed':
          setPending(outcome.pending);
          await confirm({
            title: 'Verification Failed',
            message: `${outcome.message}. If money was debited, use "Retry verification" before paying again.`,
            confirmText: 'OK',
            hideCancel: true,
          });
          return;
      }
    },
    [confirm, onPaid],
  );

  const deps: CheckoutDeps = useMemo(
    () => ({
      createOrder: billingApi.createOrder,
      openCheckout,
      verifyPayment: async (input) => {
        setStage('verifying');
        return billingApi.verifyPayment(input);
      },
    }),
    [],
  );

  const pay = useCallback(async () => {
    if (stage !== 'idle' || !quote || !totals || !session) return;
    setStage('processing');
    try {
      // The amount posted is the one displayed; when a quote is still on its way, wait for it (the server recomputes anyway).
      const live = await serverQuote.settle();
      if (live && couponName && !live.couponApplied) {
        toast.error(live.couponMessage || 'This coupon cannot be applied.');
        return;
      }
      if (live && applyReferral && !live.referralApplied) {
        const message = referralRefusal(live);
        referral.refuse(message);
        toast.error(message);
        return;
      }
      const outcome = await runCheckout(deps, {
        userId: session.userId,
        orgId: session.orgId,
        email: session.email ?? '',
        userName: session.name ?? '',
        orgName: session.orgName,
        planId: quote.plan.id,
        planName: capitalize(quote.plan.name),
        amount: live ? live.grandTotal : totals.grandTotal,
        staffLimit: quote.chargedStaff,
        couponCode: applyReferral ? null : (couponState.coupon?.name ?? null),
        mode,
        applyReferral,
      });
      await handleOutcome(outcome, quote.plan.id);
    } catch (e) {
      const message = getErrorMessage(e, 'Failed to create order');
      // A 400 on an order with a reward (`referral_not_applicable` &c.; the code is not readable in browsers): the reward is gone (used up, wrong plan): drop it, which re-quotes.
      if (applyReferral && isReferralOrderError(e)) referral.refuse(message);
      toast.error(message);
    } finally {
      setStage('idle');
    }
  }, [stage, quote, totals, session, deps, couponState.coupon, couponName, applyReferral, referral, serverQuote, mode, handleOutcome, toast]);

  const retryVerification = useCallback(async () => {
    if (!pending || !quote || stage !== 'idle') return;
    setStage('verifying');
    try {
      await handleOutcome(await verifyPending(deps, pending), quote.plan.id);
    } finally {
      setStage('idle');
    }
  }, [pending, quote, stage, deps, handleOutcome]);

  if (!canPurchase()) return <PurchaseUnavailable title="Payment" subscription={sub.data} />;

  const needsCatalogue = mode === 'new';
  if (sub.isLoading || (needsCatalogue && catalogue.isLoading)) {
    return (
      <Screen title="Payment Summary">
        <SkeletonList count={3} />
      </Screen>
    );
  }
  if ((mode !== 'new' && sub.isError) || (needsCatalogue && catalogue.isError)) {
    return (
      <Screen title="Payment Summary">
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
  if (!quote || !totals) {
    return (
      <Screen title="Payment Summary">
        <EmptyState
          icon="credit-card"
          title="Nothing to pay for"
          message="Choose a plan first."
          action={{ label: 'Go to subscription', onPress: () => router.replace(routes.admin.billing.overview) }}
        />
      </Screen>
    );
  }

  const planTitle = `${capitalize(quote.plan.name)} Plan`;
  const featureCount = planFeatureIds(quote.plan.name).length;
  const userName = session?.name ?? '';
  const mailBody = `Hi Team,\n\nI'm ${userName} from ${session?.orgName ?? ''}, ${session?.orgId ?? ''}. I'm planning to take a Clockyn subscription. Could you please provide me with a better discount coupon?\n\nThanks & Regards,\n${userName}`;

  const planCard = (
    <Card variant="gradient" testID="checkout-plan-card">
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Text variant="title2" color="onGradient">
            {planTitle}
          </Text>
          <Badge label={MODE_BADGE[mode]} tone="success" />
        </View>
        <Text variant="title3" color="onGradient">
          {`${formatINR(quote.plan.amount)}/staff`}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <Text variant="callout" color="onGradient">{`${quote.chargedStaff} Staff`}</Text>
          <Text variant="callout" color="onGradient">{`${featureCount} ${featureCount === 1 ? 'Feature' : 'Features'}`}</Text>
          <Text variant="callout" color="onGradient">{`Valid till ${formatDate((shownQuote ?? quote).validTill)}`}</Text>
        </View>
      </View>
    </Card>
  );

  const pendingCard = pending ? (
    <Card variant="outlined" testID="pending-verification" style={{ gap: spacing.sm }}>
      <Text variant="bodyStrong">Payment not confirmed yet</Text>
      <Text variant="callout" color="textSecondary">
        Your payment went through but we could not confirm it with the server. Retry before paying again.
      </Text>
      <Button title="Retry verification" variant="secondary" onPress={() => void retryVerification()} loading={stage === 'verifying'} testID="retry-verify" />
    </Card>
  ) : null;

  const referralPercent = quoteReferralPercent(sq) ?? (referral.offer?.percent || null);
  const referralDiscount = sq?.referralApplied ? { label: quoteReferralLabel(sq), amount: sq.discountAmount } : null;

  const breakdown = (
    <PriceBreakdown
      quote={shownQuote ?? quote}
      totals={totals}
      coupon={couponState.coupon}
      discountLabel={sq ? quoteDiscountLabel(sq) : undefined}
      totalLoading={serverQuote.loading}
      referralDiscount={referralDiscount}
      couponSlot={
        noCoupon ? null : (
          <View style={{ gap: spacing.md }}>
            <CouponSection
              coupon={couponState.coupon}
              input={couponState.input}
              error={couponState.error}
              applying={couponState.applying}
              onChangeInput={couponState.changeInput}
              // The coupon is priced WITHOUT the reward (one replaces the other once it sticks).
              onApply={() => void couponState.apply((code) => serverQuote.preview({ couponCode: code, applyReferral: false }))}
              badgeLabel={sq ? quoteBadgeLabel(sq, couponState.coupon) : undefined}
              notice={sq ? quoteNotice(sq) : null}
              onRemove={couponState.remove}
              mailBody={mailBody}
            />
            {referral.visible && referral.offer ? (
              <ReferralRewardCard
                offer={referral.offer}
                applied={applyReferral}
                percent={referralPercent}
                note={referral.note}
                onApply={referral.apply}
                onRemove={referral.remove}
              />
            ) : null}
          </View>
        )
      }
    />
  );

  return (
    <Screen
      title="Payment Summary"
      testID="checkout-screen"
      footer={
        <View style={{ gap: spacing.xs }}>
          <Button
            title={`Pay ${formatINR(totals.grandTotal)}`}
            icon="lock"
            fullWidth
            loading={stage !== 'idle'}
            disabled={stage !== 'idle' || totals.grandTotal <= 0}
            onPress={() => void pay()}
            testID="pay-button"
          />
          <Text variant="caption" color="textMuted" align="center">
            SSL Secured · PCI DSS · Cancel anytime
          </Text>
        </View>
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.xl, alignItems: 'flex-start' }}>
        <Reveal index={0} style={{ flex: isDesktop ? 1 : undefined, gap: spacing.lg, width: '100%' }}>
          {planCard}
          {pendingCard}
        </Reveal>
        <Reveal index={1} style={{ flex: isDesktop ? 1 : undefined, width: '100%' }}>
          {breakdown}
        </Reveal>
      </View>

      <LoadingOverlay visible={stage === 'verifying'} message="Verifying payment…" />

      <Modal
        visible={couponState.welcomeOpen}
        onClose={couponState.closeWelcome}
        title="Welcome Discount!"
        size="sm"
        footer={<Button title="Great, Thanks!" fullWidth onPress={couponState.closeWelcome} testID="welcome-close" />}
      >
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Icon name="party-popper" size={40} color="primary" />
          <Text align="center" color="textSecondary">{`${couponState.coupon?.name ?? ''} has been applied as a one-time welcome offer.`}</Text>
          <Badge label={`${couponState.coupon?.discountPercent ?? 0}% OFF`} tone="success" />
        </View>
      </Modal>

      <Modal
        visible={successOpen}
        dismissible={false}
        onClose={() => undefined}
        title="Payment Successful!"
        size="sm"
        footer={
          <Button
            title="Go to Dashboard"
            fullWidth
            onPress={() => {
              setSuccessOpen(false);
              router.replace(routes.admin.home);
            }}
            testID="go-dashboard"
          />
        }
      >
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Icon name="check-circle" size={44} color="success" />
          <Text align="center" color="textSecondary">{`Your ${planTitle} is now active. Enjoy all the features!`}</Text>
          <Badge label={`${planTitle} Active`} tone="success" />
        </View>
      </Modal>
    </Screen>
  );
}
