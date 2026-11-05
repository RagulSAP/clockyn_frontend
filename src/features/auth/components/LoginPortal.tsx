import React from 'react';
import { View } from 'react-native';

import { Spinner } from '@/components/ui';
import { spacing } from '@/theme';

import { useAuthMode } from '../hooks/useAuthMode';
import { useLoginFlow } from '../hooks/useLoginFlow';
import type { LoginPortalKind } from '../utils/loginMachine';
import { MobileOtpLoginForm } from './MobileOtpLoginForm';

function LoginPortalForm({ portal, mode }: { portal: LoginPortalKind; mode: 'otp' | 'email' }) {
  const flow = useLoginFlow(portal, mode);
  return <MobileOtpLoginForm flow={flow} />;
}

/**
 * The sign-in card of a portal. The deployment's sign-in mode (backend `USER_AUTH`: mobile + SMS code, or email + emailed
 * code) is read first so the user never sees, or types into, the wrong form.
 */
export function LoginPortal({ portal }: { portal: LoginPortalKind }) {
  const { mode, loading } = useAuthMode();
  if (loading) {
    return (
      <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }} testID="login-mode-loading">
        <Spinner />
      </View>
    );
  }
  return <LoginPortalForm key={mode} portal={portal} mode={mode} />;
}
