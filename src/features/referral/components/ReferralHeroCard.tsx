import React from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, Text, type IconName } from '@/components/ui';
import { withAlpha } from '@/components/ui/internal/color';
import { Touchable } from '@/components/ui/internal/Touchable';
import { radii, spacing, useTheme } from '@/theme';
import type { ReferralInfo } from '@/types/api/referral';

import type { CopiedWhat } from '../hooks/useReferralActions';

export type ReferralHeroActions = {
  copied: CopiedWhat;
  share: () => void;
  whatsapp: () => void;
  sms: () => void;
  copyCode: () => void;
  copyMessage: () => void;
};

type TileProps = { icon: IconName; label: string; onPress: () => void; solid?: boolean; testID: string; accessibilityLabel?: string };

/** One action of the hero: a translucent tile on the graphite card (the primary one is solid white). */
function ActionTile({ icon, label, onPress, solid, testID, accessibilityLabel }: TileProps) {
  const { colors } = useTheme();
  const fg = solid ? colors.gradientEnd : colors.onGradient;
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      radius={radii.md}
      style={{
        flex: 1,
        minWidth: 64,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        borderRadius: radii.md,
        backgroundColor: solid ? colors.onGradient : withAlpha(colors.onGradient, 0.14),
        borderWidth: 1,
        borderColor: solid ? colors.onGradient : withAlpha(colors.onGradient, 0.18),
      }}
    >
      <Icon name={icon} size={20} color={fg} />
      <Text variant="caption" weight="semibold" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

export type ReferralHeroCardProps = {
  info: ReferralInfo;
  actions: ReferralHeroActions;
  /** Show the text-message action (phones only). */
  canSms: boolean;
};

/** The organisation's code in large spaced letters, the offer in one line and the share / copy actions. */
export function ReferralHeroCard({ info, actions, canSms }: ReferralHeroCardProps) {
  const { colors } = useTheme();
  const plans = info.eligiblePlans.join(' and ');
  const codeCopied = actions.copied === 'code';
  const messageCopied = actions.copied === 'message';

  return (
    <Card variant="gradient" padding={spacing.xl} testID="referral-hero">
      <View style={{ gap: spacing.lg }}>
        <Badge label={`${info.percent}% off for you and your friend`} tone="primary" icon="gift" testID="referral-offer-badge" />

        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" color="onGradient" style={{ opacity: 0.75 }}>
            Your referral code
          </Text>
          <Touchable
            onPress={actions.copyCode}
            accessibilityRole="button"
            accessibilityLabel={`Referral code ${info.code.split('').join(' ')}. Tap to copy`}
            radius={radii.md}
            testID="referral-code-box"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.lg,
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: withAlpha(colors.onGradient, 0.45),
              backgroundColor: withAlpha(colors.onGradient, 0.08),
            }}
          >
            <Text variant="display" color="onGradient" style={{ letterSpacing: 10, paddingLeft: 10 }} testID="referral-code" selectable>
              {info.code}
            </Text>
          </Touchable>
        </View>

        <Text variant="body" color="onGradient" style={{ opacity: 0.9 }} testID="referral-offer-copy">
          {`Your friend gets ${info.percent}% off and so do you. Valid on ${plans} plans only.`}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <ActionTile solid icon="share" label="Share" onPress={actions.share} testID="referral-share" accessibilityLabel="Share your referral code" />
          <ActionTile icon="chat" label="WhatsApp" onPress={actions.whatsapp} testID="referral-whatsapp" accessibilityLabel="Share on WhatsApp" />
          {canSms ? <ActionTile icon="message-square" label="SMS" onPress={actions.sms} testID="referral-sms" accessibilityLabel="Share by text message" /> : null}
          <ActionTile
            icon={codeCopied ? 'check' : 'copy'}
            label={codeCopied ? 'Copied' : 'Copy code'}
            onPress={actions.copyCode}
            testID="referral-copy-code"
            accessibilityLabel="Copy referral code"
          />
        </View>

        <Touchable
          onPress={actions.copyMessage}
          accessibilityRole="button"
          accessibilityLabel="Copy the share message"
          testID="referral-copy-message"
          radius={radii.sm}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Icon name={messageCopied ? 'check' : 'link'} size={15} color="onGradient" />
          <Text variant="callout" weight="semibold" color="onGradient" style={{ opacity: 0.9 }}>
            {messageCopied ? 'Message copied' : 'Copy message'}
          </Text>
        </Touchable>
      </View>
    </Card>
  );
}
