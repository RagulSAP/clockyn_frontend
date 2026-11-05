import React from 'react';
import { Linking, Pressable, View } from 'react-native';

import { Badge, Button, Text, TextField } from '@/components/ui';
import { env } from '@/config/env';
import { spacing } from '@/theme';
import type { Coupon } from '@/types/api/billing';

export type CouponSectionProps = {
  coupon: Coupon | null;
  input: string;
  error: string | null;
  applying: boolean;
  onChangeInput: (text: string) => void;
  onApply: () => void;
  onRemove: () => void;
  /** Pre-filled body of the "better discount" e-mail. */
  mailBody: string;
  /** Badge text of the applied coupon; defaults to `NAME (P% off)` (flat coupons come with the server's wording). */
  badgeLabel?: string;
  /** Server verdict about the APPLIED coupon when it no longer discounts (e.g. minimum amount not met). */
  notice?: string | null;
};

/** Coupon entry / applied badge and the "contact sales" link (hidden when no sales e-mail is configured). */
export function CouponSection({ coupon, input, error, applying, onChangeInput, onApply, onRemove, mailBody, badgeLabel, notice }: CouponSectionProps) {
  const salesEmail = env.salesEmail;
  const mailto = salesEmail
    ? `mailto:${salesEmail}?subject=${encodeURIComponent('Clockyn - Requesting More Discount Coupon')}&body=${encodeURIComponent(mailBody)}`
    : '';

  return (
    <View style={{ gap: spacing.sm }} testID="coupon-section">
      {coupon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Badge label={badgeLabel ?? `${coupon.name} (${coupon.discountPercent}% off)`} tone={notice ? 'warning' : 'success'} icon="percent" testID="coupon-badge" />
          <Button title="Remove" variant="ghost" size="sm" onPress={onRemove} testID="coupon-remove" />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={input}
              onChangeText={onChangeInput}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
              autoCorrect={false}
              error={error}
              onSubmitEditing={onApply}
              accessibilityLabel="Coupon code"
              testID="coupon-input"
            />
          </View>
          <Button title="Apply" variant="secondary" loading={applying} disabled={input.trim() === ''} onPress={onApply} testID="coupon-apply" />
        </View>
      )}
      {coupon && notice ? (
        <Text variant="caption" color="warning" testID="coupon-notice">
          {notice}
        </Text>
      ) : null}
      {mailto ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL(mailto).catch(() => undefined);
          }}
          testID="coupon-contact"
        >
          <Text variant="caption" color="textSecondary">
            {'Looking for a special discount? '}
            <Text variant="caption" color="primary" weight="semibold" style={{ textDecorationLine: 'underline' }}>
              Contact sales
            </Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
