import React from 'react';
import { View } from 'react-native';

import { Icon, Spinner, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { REFERRAL_CODE_LENGTH } from '@/features/referral/utils/code';
import type { ReferralCodeField } from '../hooks/useReferralCode';

/** Optional "Referral code" field: upper-cased as you type, checked when complete / left, "Referred by <org>" when accepted. */
export function ReferralCodeInput({ field }: { field: ReferralCodeField }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label="Referral code (optional)"
        value={field.code}
        onChangeText={field.setCode}
        onBlur={field.blur}
        placeholder="e.g. K7M2QX"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={REFERRAL_CODE_LENGTH}
        error={field.error || undefined}
        testID="reg-referral-code"
      />
      {field.status === 'checking' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} testID="reg-referral-checking">
          <Spinner size="small" />
          <Text variant="caption" color="textMuted">
            Checking code...
          </Text>
        </View>
      ) : null}
      {field.status === 'valid' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} testID="reg-referral-valid" accessibilityRole="text">
          <Icon name="check-circle" size={16} color="success" />
          <Text variant="callout" weight="semibold" color="success" style={{ flex: 1 }}>
            {field.referrerOrgName ? `Referred by ${field.referrerOrgName}` : 'Referral code applied'}
          </Text>
        </View>
      ) : null}
      {field.status === 'unchecked' ? (
        <Text variant="caption" color="textMuted" testID="reg-referral-unchecked">
          We could not check this code right now. It will be checked when you register.
        </Text>
      ) : null}
    </View>
  );
}
