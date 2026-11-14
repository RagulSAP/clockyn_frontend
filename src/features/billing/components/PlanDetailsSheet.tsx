import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge, BottomSheet, Button, Card, ErrorState, Icon, Skeleton, Text, toneColors } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';
import type { Plan, Subscription } from '@/types/api/plans';

import { monthLabel, tierSavings } from '../utils/pricing';
import {
  BILLING_PILL,
  BILLING_TONE,
  groupPlans,
  isActiveTier,
  isTierDisabled,
  planFeatureList,
  planTone,
  type BillingState,
} from '../utils/planState';

export type PlanDetailsSheetProps = {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  /** The plan catalogue failed to load. */
  error?: boolean;
  onRetry?: () => void;
  subscription: Subscription | null | undefined;
  state: BillingState;
  plans: readonly Plan[];
  selectedTierId: number | null;
  onSelectTier: (tier: Plan | null) => void;
  /** A tapped tier that cannot be chosen (`active` = the running plan, otherwise a downgrade). */
  onBlockedTier: (reason: 'active' | 'downgrade') => void;
  onContinue: (tier: Plan) => void;
};

/** Width of one duration card in the horizontally scrolling row. */
const TIER_WIDTH = 140;

function TierBox({
  tier,
  tone,
  selected,
  disabled,
  active,
  onPress,
}: {
  tier: Plan;
  tone: ReturnType<typeof planTone>;
  selected: boolean;
  disabled: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  const bg = active ? colors.surfaceMuted : selected ? t.fg : colors.surface;
  const fg = selected ? colors.onPrimary : colors.text;
  const savings = tierSavings(tier);
  const hasOffer = savings.freeMonths > 0;
  const offerFg = selected ? colors.onPrimary : toneColors('success', colors).fg;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      // react-native-web ignores `accessibilityState`: expose the selection through the aria prop as well
      aria-selected={selected}
      accessibilityLabel={`${monthLabel(tier.months)} ${formatINR(tier.amount)} per staff per month${
        hasOffer ? `, ${savings.label}, save ${formatINR(savings.savePerStaff)} per staff` : ''
      }${active ? ', current plan' : ''}`}
      testID={`tier-${tier.id}`}
      style={{
        // fixed width: the row scrolls sideways, so every duration keeps the same size however many there are
        width: TIER_WIDTH,
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: selected ? t.fg : colors.border,
        backgroundColor: bg,
        opacity: disabled && !active ? 0.45 : 1,
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text variant="callout" weight="semibold" style={{ color: fg }}>
          {monthLabel(tier.months)}
        </Text>
        {active ? <Icon name="check-check" size={14} color="textMuted" /> : null}
      </View>
      <Text variant="title2" style={{ color: fg }}>
        {formatINR(tier.amount)}
      </Text>
      <Text variant="caption" style={{ color: selected ? colors.onPrimary : colors.textMuted }}>
        {active ? 'Active' : '/staff/mo'}
      </Text>
      {hasOffer ? (
        <View style={{ marginTop: spacing.xs, gap: 2 }} testID={`tier-offer-${tier.id}`}>
          <Text variant="caption" weight="semibold" style={{ color: offerFg }}>
            {savings.label}
          </Text>
          <Text variant="caption" style={{ color: offerFg }}>
            {`Save ${formatINR(savings.savePerStaff)}/staff`}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** "Plan Details": current plan summary, what the plan includes and every plan with its duration tiers. */
export function PlanDetailsSheet({
  visible,
  onClose,
  loading,
  error,
  onRetry,
  subscription,
  state,
  plans,
  selectedTierId,
  onSelectTier,
  onBlockedTier,
  onContinue,
}: PlanDetailsSheetProps) {
  const { colors } = useTheme();
  const groups = groupPlans(plans);
  const activeRef = {
    isActive: state === 'paid-active',
    planName: subscription?.planName ?? null,
    planMonths: subscription?.planMonths ?? null,
  };
  const showIncludes = state === 'paid-active' || state === 'paid-expired';

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Plan Details" snap="tall" size="lg" testID="plan-details-sheet">
      {loading ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={72} />
          <Skeleton height={160} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Card variant="muted">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="title3">{subscription?.planName?.trim() || 'No Active Plan'}</Text>
                <Text variant="caption" color="textMuted">{`Valid till ${formatDate(subscription?.endDate)}`}</Text>
              </View>
              <Badge label={BILLING_PILL[state]} tone={BILLING_TONE[state]} dot />
            </View>
          </Card>

          {showIncludes && subscription ? (
            <Card variant="outlined">
              <Text variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
                Plan Includes
              </Text>
              {[
                ['Duration', subscription.planMonths ? monthLabel(subscription.planMonths) : '--'],
                ['Amount', subscription.planAmount !== null ? `${formatINR(subscription.planAmount)}/staff/month` : '--'],
                ['Start Date', formatDate(subscription.startDate)],
              ].map(([label, value]) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                  <Text color="textSecondary">{label}</Text>
                  <Text weight="semibold">{value}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <Text variant="title3">Available Plans</Text>
          {error && groups.length === 0 ? (
            <ErrorState compact message="We could not load the plans." onRetry={onRetry} />
          ) : groups.length === 0 ? (
            <Text color="textMuted">No plans are available right now.</Text>
          ) : (
            groups.map((group) => {
              const tone = planTone(group.name);
              const t = toneColors(tone, colors);
              const isCurrentPlan = state === 'paid-active' && group.key === (subscription?.planName ?? '').trim().toLowerCase();
              const selectedHere = group.tiers.find((x) => x.id === selectedTierId) ?? null;
              return (
                <Card key={group.key} variant="outlined" testID={`plan-group-${group.key}`} style={{ borderColor: colors.borderStrong, gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="title3">{`${group.name} Plan`}</Text>
                    {isCurrentPlan ? <Badge label="CURRENT" tone={tone} size="sm" /> : null}
                  </View>
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="caption" color="textMuted">
                      Features
                    </Text>
                    {planFeatureList(group.name).map((f) => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Icon name="check" size={14} color={t.fg} />
                        <Text variant="callout">{f}</Text>
                      </View>
                    ))}
                  </View>
                  <Text variant="caption" color="textMuted">
                    Select Duration
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    testID={`tier-scroll-${group.key}`}
                    // the cards bleed to the card's edge while scrolling; the padding keeps the first and last one un-clipped
                    contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2, paddingHorizontal: 2 }}
                  >
                    {group.tiers.map((tier) => {
                      const active = isActiveTier(subscription, state, tier);
                      const disabled = active || isTierDisabled(activeRef, { name: tier.name, months: tier.months });
                      return (
                        <TierBox
                          key={tier.id}
                          tier={tier}
                          tone={tone}
                          selected={selectedTierId === tier.id}
                          active={active}
                          disabled={disabled}
                          onPress={() => {
                            if (active) onBlockedTier('active');
                            else if (disabled) onBlockedTier('downgrade');
                            else onSelectTier(selectedTierId === tier.id ? null : tier);
                          }}
                        />
                      );
                    })}
                  </ScrollView>
                  {selectedHere ? (
                    <Button title="Continue to Pay" icon="lock" onPress={() => onContinue(selectedHere)} fullWidth testID="continue-to-pay" />
                  ) : null}
                </Card>
              );
            })
          )}
        </View>
      )}
    </BottomSheet>
  );
}
