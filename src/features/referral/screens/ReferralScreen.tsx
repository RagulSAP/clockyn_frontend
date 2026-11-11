import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Screen, useBreakpoint } from '@/components/layout';
import { EmptyState, ErrorState, Reveal, SectionHeader, Skeleton } from '@/components/ui';
import { canPurchase } from '@/features/billing/utils/platformPolicy';
import { useRefreshOnFocus } from '@/hooks';
import { getErrorMessage } from '@/lib/api/client';
import { useRole, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { HowItWorks } from '../components/HowItWorks';
import { ReferralHeroCard } from '../components/ReferralHeroCard';
import { ReferredOrgsList } from '../components/ReferredOrgsList';
import { RewardsSummary } from '../components/RewardsSummary';
import { useReferral } from '../hooks/useReferral';
import { useReferralActions } from '../hooks/useReferralActions';
import { canSendSms } from '../utils/share';

function ReferralSkeleton() {
  return (
    <View style={{ gap: spacing.lg }} testID="referral-loading">
      <Skeleton height={330} style={{ borderRadius: 20 }} />
      <Skeleton height={20} width="45%" />
      <Skeleton height={150} style={{ borderRadius: 16 }} />
      <Skeleton height={20} width="55%" />
      <Skeleton height={120} style={{ borderRadius: 16 }} />
    </View>
  );
}

/** Refer & Earn (org admin): the organisation's code, how it works, reward counts and the organisations it referred. */
export default function ReferralScreen() {
  const role = useRole();
  const session = useSession();
  const { isDesktop } = useBreakpoint();
  const q = useReferral();
  const [refreshing, setRefreshing] = useState(false);

  useRefreshOnFocus(q.refetch);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [q]);

  const info = q.data;
  const actions = useReferralActions(info?.code ?? '', info?.shareMessage ?? '');
  const title = 'Refer & Earn';

  if (role !== null && role !== 1) {
    return (
      <Screen title={title} testID="referral-screen">
        <EmptyState icon="lock" title="Admins only" message="Refer & Earn is managed by your organisation's admin." testID="referral-admin-only" />
      </Screen>
    );
  }

  if (q.isError && !info) {
    return (
      <Screen title={title} subtitle={session?.orgName || undefined} testID="referral-screen">
        <ErrorState message={getErrorMessage(q.error, 'We could not load your referral details.')} onRetry={() => void q.refetch()} testID="referral-error" />
      </Screen>
    );
  }

  const hero = info ? (
    <Reveal index={0}>
      <ReferralHeroCard info={info} actions={actions} canSms={canSendSms()} />
    </Reveal>
  ) : null;

  const how = info ? (
    <Reveal index={1} style={{ gap: spacing.md }}>
      <SectionHeader title="How it works" />
      <HowItWorks percent={info.percent} />
    </Reveal>
  ) : null;

  const rewards = info ? (
    <Reveal index={2} style={{ gap: spacing.md }}>
      <SectionHeader title="Your rewards" subtitle={`${info.percent}% off a Prime or Elite plan, once per purchase`} />
      <RewardsSummary summary={info.summary} myReward={info.myReward} canBuy={canPurchase()} />
    </Reveal>
  ) : null;

  const referred = info ? (
    <Reveal index={3} style={{ gap: spacing.md }}>
      <SectionHeader
        title="Organisations you referred"
        subtitle={info.summary.referredCount > 0 ? `${info.summary.referredCount} signed up, ${info.summary.convertedCount} paid` : undefined}
      />
      <ReferredOrgsList referrals={info.referrals} />
    </Reveal>
  ) : null;

  return (
    <Screen title={title} subtitle={session?.orgName || undefined} refreshing={refreshing} onRefresh={onRefresh} testID="referral-screen">
      {q.isLoading || !info ? (
        <ReferralSkeleton />
      ) : isDesktop ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: spacing.xl }}>
            {hero}
            {how}
          </View>
          <View style={{ flex: 1, gap: spacing.xl }}>
            {rewards}
            {referred}
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          {hero}
          {how}
          {rewards}
          {referred}
        </View>
      )}
    </Screen>
  );
}
