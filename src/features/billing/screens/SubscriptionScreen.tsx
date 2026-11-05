import React, { useCallback, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Screen, useBreakpoint } from '@/components/layout';
import { Card, ErrorState, ListItem, Reveal, SectionHeader, Skeleton, Text, useConfirm } from '@/components/ui';
import { env } from '@/config/env';
import { useRefreshOnFocus } from '@/hooks';
import { routes, useAppRouter } from '@/lib/navigation';
import { useRole, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { Plan } from '@/types/api/plans';

import { PlanDetailsSheet } from '../components/PlanDetailsSheet';
import { PlanStatusCard } from '../components/PlanStatusCard';
import { SupportNote } from '../components/SupportNote';
import { usePlanCatalogue, useBillingState, useSubscription, useUsedStaff } from '../hooks/useBillingData';
import { canPurchase, showWebPortalLink } from '../utils/platformPolicy';

/** Subscriptions & billing overview. iOS is view-only (no plan picker, upgrade, renew or web link). */
export default function SubscriptionScreen() {
  const router = useAppRouter();
  const confirm = useConfirm();
  const session = useSession();
  const role = useRole();
  const { isDesktop } = useBreakpoint();
  const purchase = canPurchase();

  const sub = useSubscription();
  const catalogue = usePlanCatalogue();
  const used = useUsedStaff();
  const { state } = useBillingState();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refetchAll = useCallback(async () => {
    await Promise.allSettled([sub.refetch(), used.refetch(), purchase ? catalogue.refetch() : Promise.resolve()]);
  }, [sub, used, catalogue, purchase]);
  useRefreshOnFocus(refetchAll);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  const openSheet = () => {
    setSelectedTierId(null);
    setSheetOpen(true);
    void catalogue.refetch();
  };
  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedTierId(null);
  };

  const askSelectPlanFirst = async () => {
    const goToDetails = await confirm({
      title: 'Select a Plan First',
      message: "You don't have an active plan yet. Please go to Plan Details and select a plan before upgrading.",
      confirmText: 'Go to Plan Details',
      cancelText: 'Cancel',
    });
    if (goToDetails) openSheet();
  };

  const onBlockedTier = (reason: 'active' | 'downgrade') => {
    void confirm(
      reason === 'active'
        ? {
            title: "You're on This Plan",
            message: 'This is your current active plan. Please select a different duration or a higher plan to upgrade.',
            confirmText: 'Got it',
            hideCancel: true,
          }
        : {
            title: 'Downgrade Not Allowed',
            message: 'You cannot downgrade to a lower plan or a shorter duration. Please select a higher plan or a longer duration to upgrade.',
            confirmText: 'Got it',
            hideCancel: true,
          },
    );
  };

  const onContinue = (tier: Plan) => {
    closeSheet();
    router.push(routes.admin.billing.upgrade, { mode: 'new', planId: tier.id });
  };

  const onUpgrade = () => {
    if (state === 'none') void askSelectPlanFirst();
    else router.push(routes.admin.billing.upgrade, { mode: 'upgrade' });
  };
  const onRenew = () => {
    if (state === 'none') void askSelectPlanFirst();
    else router.push(routes.admin.billing.upgrade, { mode: 'renew' });
  };
  const openInvoices = () => router.push(routes.admin.billing.invoices);

  const loading = sub.isLoading;
  const failed = sub.isError && !sub.data;

  const statusCard = (
    <Reveal index={0}>
      {loading ? (
        <Skeleton height={220} style={{ borderRadius: 20 }} />
      ) : (
        <PlanStatusCard subscription={sub.data} state={state} usedStaff={used.data ?? 0} readOnly={!purchase} />
      )}
    </Reveal>
  );

  const actions = (
    <Card padding={0}>
      <ListItem icon="file-text" title="Plan Details" subtitle="View your current plan features" onPress={openSheet} divider testID="action-plan-details" />
      <ListItem icon="trending-up" title="Upgrade Plan" subtitle="Unlock more features & users" onPress={onUpgrade} divider testID="action-upgrade" />
      <ListItem icon="refresh" title="Renew Plan" subtitle="Extend your subscription validity" onPress={onRenew} divider testID="action-renew" />
      <ListItem icon="receipt" title="Download Invoices" subtitle="Access your billing history" onPress={openInvoices} testID="action-invoices" />
    </Card>
  );

  const portal = showWebPortalLink(Platform.OS, env.webPortalUrl) ? (
    <Reveal index={1}>
      <Card
        variant="outlined"
        onPress={() => {
          void Linking.openURL(env.webPortalUrl).catch(() => undefined);
        }}
        accessibilityLabel="Manage billing on the web"
        testID="web-portal-link"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Also available on web</Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {`Manage billing at ${env.webPortalUrl.replace(/^https?:\/\//, '')}`}
            </Text>
          </View>
        </View>
      </Card>
    </Reveal>
  ) : null;

  if (failed) {
    return (
      <Screen title={purchase ? 'Subscriptions & Billing' : 'Subscription'} subtitle={session?.orgName}>
        <ErrorState message="We could not load your subscription." onRetry={() => void sub.refetch()} />
      </Screen>
    );
  }

  if (!purchase) {
    return (
      <Screen title="Subscription" subtitle={session?.orgName} refreshing={refreshing} onRefresh={onRefresh} testID="subscription-screen">
        <View style={{ gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          {statusCard}
          <Reveal index={1}>
            <Card padding={0}>
              <ListItem icon="receipt" title="Billing History" subtitle="Access your billing history" onPress={openInvoices} testID="action-invoices" />
            </Card>
          </Reveal>
          {role === 1 ? <SupportNote /> : <Text variant="callout" color="textSecondary" align="center">Please contact your organization administrator for subscription details.</Text>}
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Subscriptions & Billing" subtitle={session?.orgName} refreshing={refreshing} onRefresh={onRefresh} testID="subscription-screen">
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: isDesktop ? 1 : undefined, gap: spacing.lg, width: '100%' }}>
          {statusCard}
          {portal}
        </View>
        <Reveal index={2} style={{ flex: isDesktop ? 1 : undefined, gap: spacing.md, width: '100%' }}>
          <SectionHeader title="Billing Actions" />
          {actions}
        </Reveal>
      </View>

      <PlanDetailsSheet
        visible={sheetOpen}
        onClose={closeSheet}
        loading={catalogue.isLoading}
        error={catalogue.isError}
        onRetry={() => void catalogue.refetch()}
        subscription={sub.data}
        state={state}
        plans={catalogue.data ?? []}
        selectedTierId={selectedTierId}
        onSelectTier={(tier) => setSelectedTierId(tier ? tier.id : null)}
        onBlockedTier={onBlockedTier}
        onContinue={onContinue}
      />
    </Screen>
  );
}
