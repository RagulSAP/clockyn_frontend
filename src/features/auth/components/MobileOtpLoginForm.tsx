import React from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, OTPInput, Text, TextField, type ButtonProps, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { LoginFlow } from '../hooks/useLoginFlow';
import type { PrimaryAction } from '../utils/loginMachine';
import { MOBILE_LENGTH, OTP_LENGTH } from '../utils/validation';
import { InfoBox } from './InfoBox';

export const MISMATCH_TEXT = 'You are logging in from a different device. Tap "Request Access" to submit a device change request to your admin.';
export const MISMATCH_PENDING_TEXT = 'Your device change request is pending admin approval. You will be able to login once approved.';

const ROLE_BADGE: Record<'admin' | 'staff', { icon: IconName; label: string; tone: 'primary' | 'success' }> = {
  admin: { icon: 'briefcase', label: 'Admin Portal', tone: 'primary' },
  staff: { icon: 'fingerprint', label: 'Employee Access', tone: 'success' },
};

const BUTTON: Record<PrimaryAction, { title: string; variant: ButtonProps['variant']; icon?: IconName }> = {
  verifying: { title: 'Checking device...', variant: 'primary' },
  'request-access': { title: 'Request Access', variant: 'secondary', icon: 'smartphone' },
  pending: { title: 'Pending...', variant: 'secondary', icon: 'clock' },
  continue: { title: 'Continue', variant: 'primary', icon: 'arrow-right' },
  'get-otp': { title: 'Get OTP', variant: 'primary' },
  'verify-otp': { title: 'Verify & Continue', variant: 'primary' },
};

/**
 * Mobile number (or, when the deployment signs in by e-mail, e-mail address) -> (trusted device: Continue | OTP) card
 * shared by the admin and staff login screens.
 */
export function MobileOtpLoginForm({ flow }: { flow: LoginFlow }) {
  const { colors } = useTheme();
  const { state, portal, action } = flow;
  const badge = ROLE_BADGE[portal];
  const accent = badge.tone === 'primary' ? colors.primary : colors.success;
  const soft = badge.tone === 'primary' ? colors.primarySoft : colors.successSoft;
  const button = BUTTON[action];
  const mismatch = portal === 'staff' && state.trust === 'mismatch';
  const showButton = action !== 'verify-otp' || state.otp.length === OTP_LENGTH;
  const byEmail = state.mode === 'email';

  return (
    <Card padding={spacing.xl} style={{ gap: spacing.xl }} testID="login-card">
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: spacing.sm,
            paddingVertical: spacing.xs + 2,
            paddingHorizontal: spacing.md,
            borderRadius: radii.pill,
            backgroundColor: soft,
          }}
        >
          <Icon name={badge.icon} size={16} color={accent} />
          <Text variant="callout" weight="semibold" style={{ color: accent }}>
            {badge.label}
          </Text>
        </View>
        <View>
          <Text variant="title1">Welcome Back</Text>
          <Text variant="body" color="textSecondary">
            {byEmail ? 'Sign in with your email address' : 'Sign in with your mobile number'}
          </Text>
        </View>
      </View>

      {state.otpSent ? (
        <View style={{ gap: spacing.md }}>
          <OTPInput value={state.otp} onChange={flow.setOtp} length={OTP_LENGTH} disabled={state.loading} testID="otp-input" />
          <Text variant="callout" color="textSecondary" align="center">
            {byEmail ? `We emailed a code to ${state.mobile}` : `OTP sent to ${state.mobile}`}
          </Text>
          <Button title={byEmail ? 'Change email' : 'Change number'} variant="ghost" size="sm" onPress={flow.changeNumber} disabled={state.loading} style={{ alignSelf: 'center' }} />
        </View>
      ) : byEmail ? (
        <TextField
          label="Email Address"
          value={state.mobile}
          onChangeText={flow.setMobile}
          placeholder="Enter email address"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          leftIcon="mail"
          onSubmitEditing={flow.submit}
          returnKeyType="go"
          testID="email-input"
        />
      ) : (
        <TextField
          label="Mobile Number"
          value={state.mobile}
          onChangeText={flow.setMobile}
          placeholder="Enter mobile number"
          prefix="+91"
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={MOBILE_LENGTH}
          autoComplete="tel"
          textContentType="telephoneNumber"
          leftIcon="smartphone"
          onSubmitEditing={flow.submit}
          returnKeyType="go"
          testID="mobile-input"
        />
      )}

      {mismatch ? <InfoBox tone={state.requestPending ? 'success' : 'warning'} icon={state.requestPending ? 'clock' : 'alert'} message={state.requestPending ? MISMATCH_PENDING_TEXT : MISMATCH_TEXT} testID="mismatch-notice" /> : null}
      {state.notice ? <InfoBox tone={state.notice.tone} message={state.notice.message} testID="login-notice" /> : null}

      {showButton ? (
        <Button
          title={button.title}
          variant={button.variant}
          icon={button.icon}
          size="lg"
          fullWidth
          loading={action === 'verifying' || state.loading || state.otpLoading}
          disabled={flow.actionDisabled}
          onPress={flow.submit}
          testID="login-action"
        />
      ) : null}
    </Card>
  );
}
