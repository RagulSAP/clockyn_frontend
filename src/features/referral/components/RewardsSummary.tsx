import React from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { MyReferralReward, ReferralSummary } from '@/types/api/referral';

import { myRewardTitle, redeemHint, rewardCaption, rewardChip } from '../utils/status';

function Cell({ label, value, color, testID }: { label: string; value: number; color: 'success' | 'warning' | 'textSecondary'; testID: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }} testID={testID}>
      <Text variant="title1" color={color} testID={`${testID}-count`}>
        {String(value)}
      </Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

export type RewardsSummaryProps = {
  summary: ReferralSummary;
  /** The reward this organisation received for having been referred (null when it was not). */
  myReward: MyReferralReward | null;
  /** False on iOS (view-only billing): the redeem hint points to Android / web. */
  canBuy: boolean;
};

/** Available / pending / used reward counts, this org's own sign-up reward, and where to redeem. */
export function RewardsSummary({ summary, myReward, canBuy }: RewardsSummaryProps) {
  const { colors } = useTheme();
  const chip = myReward ? rewardChip(myReward.status) : null;
  return (
    <View style={{ gap: spacing.md }}>
      <Card testID="referral-rewards" style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Cell label="Available" value={summary.rewardsAvailable} color="success" testID="rewards-available" />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
          <Cell label="Pending" value={summary.rewardsPending} color="warning" testID="rewards-pending" />
          <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
          <Cell label="Used" value={summary.rewardsUsed} color="textSecondary" testID="rewards-used" />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }} testID="referral-redeem-hint">
          <Icon name="info" size={16} color="textMuted" style={{ marginTop: 2 }} />
          <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
            {redeemHint(canBuy)}
          </Text>
        </View>
      </Card>

      {myReward && chip ? (
        <Card variant="outlined" testID="referral-my-reward">
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: radii.sm + 2, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="gift" size={18} color="success" />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="bodyStrong" testID="referral-my-reward-title">
                {myRewardTitle(myReward.referredByOrgName, myReward.percent)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Badge label={chip.label} tone={chip.tone} size="sm" testID="referral-my-reward-status" />
                {myReward.status === 'used' ? (
                  <Text variant="caption" color="textMuted" style={{ flexShrink: 1 }}>
                    {rewardCaption(myReward)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      ) : null}
    </View>
  );
}
