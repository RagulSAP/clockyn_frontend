import React from 'react';

import { AuthShell } from '../components/AuthShell';
import { EmployeeMobileOnlyModal } from '../components/EmployeeMobileOnlyModal';
import { LoginPortal } from '../components/LoginPortal';
import { useBackToWelcome } from '../hooks/useBackToWelcome';
import { isEmployeeAccessBlocked } from '../utils/employeeAccess';

/** Employee / manager login (roles 2 and 3 only) with the device-mismatch request flow. In a browser it only explains that this is for the mobile app. */
export default function StaffLoginScreen() {
  return isEmployeeAccessBlocked() ? <StaffLoginMobileOnly /> : <StaffLogin />;
}

function StaffLogin() {
  const goBack = useBackToWelcome();
  return (
    <AuthShell onBack={goBack} testID="staff-login">
      <LoginPortal portal="staff" />
    </AuthShell>
  );
}

/** Reached by typing /staff-login in a browser: the dialog stays on screen and closing it returns to the welcome screen. */
function StaffLoginMobileOnly() {
  const goBack = useBackToWelcome();
  return (
    <AuthShell onBack={goBack} testID="staff-login-mobile-only">
      <EmployeeMobileOnlyModal visible onClose={goBack} />
    </AuthShell>
  );
}
