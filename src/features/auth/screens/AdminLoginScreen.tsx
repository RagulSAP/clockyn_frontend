import React from 'react';

import { AuthShell } from '../components/AuthShell';
import { useBackToWelcome } from '../hooks/useBackToWelcome';
import { useLeaveAuthWhenSignedIn } from '../hooks/useLeaveAuthWhenSignedIn';
import { LoginPortal } from '../components/LoginPortal';

/** Admin portal login (role 1 only). */
export default function AdminLoginScreen() {
  const goBack = useBackToWelcome();
  useLeaveAuthWhenSignedIn();
  return (
    <AuthShell onBack={goBack} testID="admin-login">
      <LoginPortal portal="admin" />
    </AuthShell>
  );
}
