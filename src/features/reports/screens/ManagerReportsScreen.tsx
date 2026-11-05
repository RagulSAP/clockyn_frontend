import React from 'react';
import { Screen } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { useHasPermission, useRole } from '@/store/auth';
import { ReportsHub } from '../components/ReportsHub';
import { MANAGER_REPORTS_PERMISSION } from '../utils/catalogue';

/**
 * `/staff/reports` — the manager variant of the hub (Monthly Summary, Late Report, Monthly Salary, View Staff Salary).
 * The entry lives in the staff Settings screen, shown only to managers holding the "Attendance Reports" permission;
 * the screen re-checks it so a deep link cannot bypass the gate.
 */
export default function ManagerReportsScreen() {
  const role = useRole();
  const allowed = useHasPermission(MANAGER_REPORTS_PERMISSION);
  if (role !== 2 || !allowed) {
    return (
      <Screen title="Reports" testID="manager-reports-denied">
        <EmptyState icon="lock" title="Reports unavailable" message="You do not have permission to view attendance reports. Ask your admin to enable it." />
      </Screen>
    );
  }
  return <ReportsHub variant="manager" />;
}
