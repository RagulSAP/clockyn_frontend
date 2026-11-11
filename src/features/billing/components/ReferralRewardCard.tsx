import React from 'react';
import { View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { ReferralOffer } from '@/types/api/billing';

export type ReferralRewardCardProps = {
  offer: ReferralOffer;
  applied: boolean;
  /** Percent shown in the title (the quote's `referral_percent`, else the offer's); omitted when unknown. */
  percent: number | null;
  onApply: () => void;
  onRemove: () => void;
  /** Short inline note ("A coupon and a referral reward can't be combined", or the server's refusal). */
  note?: string | null;
};

/**
 * "Referral reward" row next to the coupon box: title + how many rewards are left + Apply / Remove. Disabled with the
 * server's reason when the reward cannot be used on this plan (`offer.eligible === false`).
 */
export function ReferralRewardCard({ offer, applied, percent, onApply, onRemove, note }: ReferralRewardCardProps) {
  const { colors } = useTheme();
  const disabled = !applied && !offer.eligible;
  const title = percent ? `Referral reward — ${percent}% off` : 'Referral reward';
  const count = `${offer.availableCount} available`;
  const reason = disabled ? offer.message || 'Referral reward cannot be used on this purchase' : null;
  // The same sentence twice (disabled reason + the "dropped" note) reads as noise.
  const shownNote = note && note !== reason ? note : null;

  return (
    <View
      testID="referral-reward-card"
      style={{
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: applied ? colors.success : colors.border,
        backgroundColor: applied ? colors.successSoft : colors.surfaceMuted,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: applied ? colors.success : colors.primarySoft,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Icon name="gift" size={16} color={applied ? 'onPrimary' : 'primary'} />
        </View>
        <View style={{ flex: 1, flexBasis: 150, opacity: disabled ? 0.75 : 1 }}>
          <Text variant="callout" weight="bold" testID="referral-title">
            {title}
          </Text>
          {applied ? (
            <Text variant="caption" color="success" weight="semibold" testID="referral-applied">
              {`Applied ✓ · 1 of ${offer.availableCount} ${offer.availableCount === 1 ? 'reward' : 'rewards'}`}
            </Text>
          ) : (
            <Text variant="caption" color="textSecondary" testID="referral-available">
              {count}
            </Text>
          )}
        </View>
        {applied ? (
          <Button title="Remove" variant="ghost" size="sm" onPress={onRemove} accessibilityLabel="Remove referral reward" testID="referral-remove" />
        ) : (
          <Button
            title="Apply"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onPress={onApply}
            accessibilityLabel={disabled ? `Apply referral reward, unavailable. ${reason ?? ''}` : 'Apply referral reward'}
            testID="referral-apply"
          />
        )}
      </View>
      {reason ? (
        <Text variant="caption" color="textSecondary" testID="referral-message">
          {reason}
        </Text>
      ) : null}
      {shownNote ? (
        <Text variant="caption" color="warning" testID="referral-note" accessibilityRole="alert">
          {shownNote}
        </Text>
      ) : null}
    </View>
  );
}
