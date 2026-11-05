import React from 'react';
import { View } from 'react-native';

import { Button, OTPInput, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import type { ContactOtp } from '../hooks/useContactOtp';
import { MOBILE_LENGTH, OTP_LENGTH } from '../utils/validation';

export type ContactOtpFieldProps = {
  contact: ContactOtp;
  label: string;
  placeholder: string;
  testID: string;
};

/**
 * A contact (mobile or e-mail) that must be verified by OTP: entry with "Get OTP", then the 6 boxes with "Verify",
 * then a locked "verified" field.
 */
export function ContactOtpField({ contact, label, placeholder, testID }: ContactOtpFieldProps) {
  const isMobile = contact.kind === 'mobile';

  if (!contact.needsOtp) {
    return (
      <TextField
        label={label}
        required
        value={contact.value}
        onChangeText={contact.setValue}
        onBlur={contact.onBlur}
        placeholder={placeholder}
        prefix={isMobile ? '+91' : undefined}
        keyboardType={isMobile ? 'number-pad' : 'email-address'}
        inputMode={isMobile ? 'numeric' : 'email'}
        maxLength={isMobile ? MOBILE_LENGTH : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isMobile ? 'tel' : 'email'}
        error={contact.error}
        testID={`${testID}-input`}
      />
    );
  }

  if (contact.verified) {
    return (
      <TextField
        label={label}
        required
        value={contact.value}
        onChangeText={() => undefined}
        editable={false}
        prefix={isMobile ? '+91' : undefined}
        rightIcon="check-circle"
        hint="Verified"
        testID={`${testID}-verified`}
      />
    );
  }

  if (contact.otpSent) {
    return (
      <View style={{ gap: spacing.md }} testID={`${testID}-otp`}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          {label}
          <Text variant="callout" color="danger">{' *'}</Text>
        </Text>
        <OTPInput value={contact.otp} onChange={contact.setOtp} length={OTP_LENGTH} disabled={contact.verifying} testID={`${testID}-otp-input`} />
        <Text variant="callout" color="textSecondary" align="center">
          {`Sent OTP to ${contact.value}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'center' }}>
          <Button title={isMobile ? 'Change number' : 'Change email'} variant="ghost" size="sm" onPress={contact.editContact} disabled={contact.verifying} />
          <Button title="Verify" size="sm" onPress={contact.verify} loading={contact.verifying} disabled={!contact.canVerify} testID={`${testID}-verify`} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label={label}
        required
        value={contact.value}
        onChangeText={contact.setValue}
        onBlur={contact.onBlur}
        placeholder={placeholder}
        prefix={isMobile ? '+91' : undefined}
        keyboardType={isMobile ? 'number-pad' : 'email-address'}
        inputMode={isMobile ? 'numeric' : 'email'}
        maxLength={isMobile ? MOBILE_LENGTH : undefined}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={isMobile ? 'tel' : 'email'}
        error={contact.error}
        testID={`${testID}-input`}
      />
      <Button
        title="Get OTP"
        size="sm"
        variant="secondary"
        onPress={contact.sendOtp}
        loading={contact.sending || contact.checking}
        disabled={!contact.canSend}
        testID={`${testID}-get-otp`}
      />
    </View>
  );
}
