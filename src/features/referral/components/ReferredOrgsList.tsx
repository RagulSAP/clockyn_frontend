import React from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Card, Divider, EmptyState, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { spacing } from '@/theme';
import type { ReferredOrg } from '@/types/api/referral';

import { rewardCaption, rewardChip, signupChip } from '../utils/status';

function Row({ org, index }: { org: ReferredOrg; index: number }) {
  const status = signupChip(org.status);
  const reward = org.reward ? rewardChip(org.reward.status) : null;
  return (
    <View style={{ padding: spacing.lg, gap: spacing.md }} testID={`referral-row-${index}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar name={org.orgName} size={40} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1} testID={`referral-row-${index}-name`}>
            {org.orgName}
          </Text>
          <Text variant="caption" color="textMuted">
            {org.joinedAt ? `Joined ${formatDate(org.joinedAt)}` : 'Joined recently'}
          </Text>
        </View>
        <Badge label={status.label} tone={status.tone} size="sm" testID={`referral-row-${index}-status`} />
      </View>
      {org.reward && reward ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Badge label={`Reward: ${reward.label}`} tone={reward.tone} size="sm" testID={`referral-row-${index}-reward`} />
          <Text variant="caption" color="textSecondary" style={{ flexShrink: 1 }} testID={`referral-row-${index}-reward-caption`}>
            {rewardCaption(org.reward)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "Organisations you referred": one row per organisation, or an encouraging empty state. */
export function ReferredOrgsList({ referrals }: { referrals: ReferredOrg[] }) {
  if (referrals.length === 0) {
    return (
      <Card testID="referral-empty" padding={0}>
        <EmptyState
          compact
          icon="users"
          title="No referrals yet"
          message="Share your code with a business owner you know. When they sign up with it, they show up here and your reward starts counting."
        />
      </Card>
    );
  }
  return (
    <Card padding={0} testID="referral-list">
      {referrals.map((org, i) => (
        <React.Fragment key={org.id ?? `${org.orgName}-${i}`}>
          {i > 0 ? <Divider /> : null}
          <Row org={org} index={i} />
        </React.Fragment>
      ))}
    </Card>
  );
}
