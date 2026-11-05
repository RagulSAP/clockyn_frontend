import React from 'react';
import { View, type KeyboardTypeOptions } from 'react-native';

import { Button, OTPInput, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import type { ContactVerification } from '../hooks/useContactVerification';
import { MAX_LENGTH } from '../utils/companyForm';

export type OtpContactFieldProps = {
  label: string;
  placeholder: string;
  keyboardType: KeyboardTypeOptions;
  maxLength?: number;
  value: string;
  onChange: (v: string) => void;
  /** Whether "Get OTP" is offered for the current value. */
  canRequest: boolean;
  verification: ContactVerification;
  disabled?: boolean;
  testID: string;
};

/**
 * Contact input with optional OTP verification: plain input (+ "Get OTP"), OTP entry (6 boxes + "Verify" + "Change"),
 * or a verified read-only value with a tick (+ "Change" to start over).
 */
export function OtpContactField({ label, placeholder, keyboardType, maxLength, value, onChange, canRequest, verification, disabled, testID }: OtpContactFieldProps) {
  const { state, otp, setOtp, sending, verifying, send, verify, reset } = verification;

  if (state === 'verified') {
    return (
      <View style={{ gap: spacing.xs }}>
        <TextField label={label} value={value} onChangeText={() => {}} editable={false} rightIcon="check-circle" testID={`${testID}-verified`} />
        <Button title="Change" variant="ghost" size="sm" onPress={reset} style={{ alignSelf: 'flex-start' }} disabled={disabled} />
      </View>
    );
  }

  if (state === 'sent') {
    return (
      <View style={{ gap: spacing.md }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          {label}
        </Text>
        <OTPInput value={otp} onChange={setOtp} length={MAX_LENGTH.otp} disabled={verifying} testID={`${testID}-otp`} />
        <Text variant="caption" color="textMuted">{`Sent OTP to ${value}`}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Verify" size="sm" loading={verifying} disabled={otp.length !== MAX_LENGTH.otp} onPress={() => void verify(value)} testID={`${testID}-verify`} />
          <Button title="Change" size="sm" variant="ghost" onPress={reset} disabled={verifying} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize="none"
        editable={!disabled}
        testID={testID}
      />
      {canRequest ? (
        <Button title="Get OTP" size="sm" variant="secondary" loading={sending} disabled={disabled} onPress={() => void send(value)} style={{ alignSelf: 'flex-start' }} testID={`${testID}-get-otp`} />
      ) : null}
    </View>
  );
}
