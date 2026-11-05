import { useEffect } from 'react';

import { startBackgroundTracking, startForegroundTracking, stopAllTracking } from '@/lib/platform/location';

import { trackingAction } from '../utils/punchState';

/**
 * Field-staff location tracking: starts while the employee is punched in and stops after the punch-out.
 *
 * Fixes vs v1: `isFieldStaff` comes from the freshly fetched staff record, nothing happens before today's
 * attendance has loaded (so a resumed tracker is not killed by the initial "not punched in" default), and
 * leaving the screen does not stop tracking (sign-out and the punch-out do).
 * Background tracking is Android-only (`startBackgroundTracking` resolves false elsewhere).
 */
export function useFieldTracking(input: {
  isFieldStaff: boolean;
  userId: string;
  orgId: string;
  attendanceLoaded: boolean;
  isPunchedIn: boolean;
}): void {
  const { isFieldStaff, userId, orgId, attendanceLoaded, isPunchedIn } = input;
  useEffect(() => {
    const action = trackingAction({ isFieldStaff, hasUser: userId !== '', attendanceLoaded, isPunchedIn });
    if (action === 'start') {
      void startForegroundTracking({ userId, orgId: orgId || userId }).catch(() => undefined);
      void startBackgroundTracking({ userId, orgId: orgId || userId }).catch(() => undefined);
    } else if (action === 'stop') {
      void stopAllTracking().catch(() => undefined);
    }
  }, [isFieldStaff, userId, orgId, attendanceLoaded, isPunchedIn]);
}
