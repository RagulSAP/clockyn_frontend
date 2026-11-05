import React from 'react';
import { View } from 'react-native';

import { Screen, useBreakpoint } from '@/components/layout';
import { BrandMark, GradientView, Icon, IconButton, Text, type IconName } from '@/components/ui';
import { radii, spacing } from '@/theme';

const TRUST_ITEMS: { icon: IconName; label: string }[] = [
  { icon: 'shield-check', label: 'Secure' },
  { icon: 'lock', label: 'Encrypted' },
  { icon: 'badge-check', label: 'Verified' },
];

export const FEATURE_ITEMS: { icon: IconName; label: string }[] = [
  { icon: 'map-pin', label: 'GPS' },
  { icon: 'scan-face', label: 'Face ID' },
  { icon: 'bar-chart', label: 'Reports' },
  { icon: 'shield-check', label: 'Secure' },
];

export const TAGLINE = 'Attendance Management';
export const FOOTER_TEXT = 'Trusted by teams everywhere';

export function TrustRow() {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xl }}>
      {TRUST_ITEMS.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={item.icon} size={14} color="textMuted" />
          <Text variant="caption" color="textMuted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BrandPanel() {
  return (
    <GradientView style={{ flex: 1, borderRadius: radii.xl, padding: spacing.huge, justifyContent: 'center', gap: spacing.xxl, minHeight: 520 }}>
      <BrandMark size={72} variant="stacked" tone="light" />
      <Text variant="title2" color="onGradient">
        {TAGLINE}
      </Text>
      <View style={{ gap: spacing.md }}>
        {FEATURE_ITEMS.map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name={item.icon} size={20} color="onGradient" />
            <Text variant="bodyStrong" color="onGradient">
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </GradientView>
  );
}

export type AuthShellProps = {
  children: React.ReactNode;
  /** Shows a back arrow (the login screens return to the welcome screen). */
  onBack?: () => void;
  testID?: string;
};

/**
 * Frame of the public screens: brand header over a content card on phones / tablets, a brand panel next to the
 * content on desktop web. Scrolls and lifts above the keyboard.
 */
export function AuthShell({ children, onBack, testID }: AuthShellProps) {
  const { isDesktop } = useBreakpoint();

  const content = (
    <View style={{ gap: spacing.xl, width: '100%', maxWidth: 460, alignSelf: 'center' }}>
      {children}
      {isDesktop ? null : <TrustRow />}
      <Text variant="caption" color="textMuted" align="center">
        {FOOTER_TEXT}
      </Text>
    </View>
  );

  return (
    <Screen hideBack padded testID={testID} maxWidth={isDesktop ? 1120 : 560}>
      <View style={{ minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' }}>
        {onBack ? <IconButton icon="arrow-left" variant="tonal" accessibilityLabel="Go back" onPress={onBack} testID="auth-back" /> : null}
      </View>
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: spacing.huge, alignItems: 'stretch', paddingVertical: spacing.xl }}>
          <BrandPanel />
          <View style={{ flex: 1, justifyContent: 'center' }}>{content}</View>
        </View>
      ) : (
        <View style={{ gap: spacing.xxl, paddingBottom: spacing.xl }}>
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <BrandMark size={56} variant="stacked" />
            <Text variant="callout" color="textSecondary">
              {TAGLINE}
            </Text>
          </View>
          {content}
        </View>
      )}
    </Screen>
  );
}
