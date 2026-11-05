import React from 'react';

import { AuthShell } from '../components/AuthShell';
import { useBackToWelcome } from '../hooks/useBackToWelcome';
import { LoginPortal } from '../components/LoginPortal';

/** Employee / manager login (roles 2 and 3 only) with the device-mismatch request flow. */
export default function StaffLoginScreen() {
  const goBack = useBackToWelcome();
  return (
    <AuthShell onBack={goBack} testID="staff-login">
      <LoginPortal portal="staff" />
    </AuthShell>
  );
}
