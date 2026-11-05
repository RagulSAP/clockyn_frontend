import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { faceApi } from '@/api';
import { useConfirm, useToast } from '@/components/ui';
import { useOrgPlan } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { getCurrentPosition } from '@/lib/platform/location';
import { logEvent } from '@/lib/platform/analytics';
import { getPermissionDetail, openAppSettings, requestPermission } from '@/lib/platform/permissions';
import type { PunchAction, PunchResult } from '@/types/api/face';

import { runPunchChecks, type Coords, type PunchDecision } from '../utils/punchFlow';
import type { EmployeeHomeData } from './useEmployeeHome';

const PLAN_BLOCKED_MESSAGE = 'Your plan has expired. Please contact your admin.';

const WEB_SETTINGS_HINT = " Allow access in your browser's site settings, then try again.";

export interface RecognitionRequest {
  action: PunchAction;
  /** Coordinates the geofence check passed with; reused for the punch (v1 fetched a second, possibly different fix). */
  coords: Coords;
}

export interface PunchFlow {
  /** Pre-checks are running (button shows CHECKING…). */
  checking: boolean;
  registrationOpen: boolean;
  recognition: RecognitionRequest | null;
  /** Punch button handler. */
  start: () => Promise<void>;
  closeRegistration: () => void;
  closeRecognition: () => void;
  onRegistered: () => Promise<void>;
  /** A punch was accepted by the server. */
  onPunchAccepted: (action: PunchAction, result: PunchResult) => void;
  /** Whether the server now reflects `action` (used to verify a forced punch whose response said "failed"). */
  verifyApplied: (action: PunchAction) => Promise<boolean>;
}

/**
 * The punch button: runs the ordered pre-checks (see `runPunchChecks`), tells the user what is wrong (every failure
 * is surfaced — v1 swallowed geofence request errors) and opens the registration / recognition camera.
 */
export function usePunchFlow(home: EmployeeHomeData, opts: { onAccepted?: (action: PunchAction, result: PunchResult) => void } = {}): PunchFlow {
  const confirm = useConfirm();
  const toast = useToast();
  const plan = useOrgPlan();
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionRequest | null>(null);
  const busy = useRef(false);
  const homeRef = useRef(home);
  const onAcceptedRef = useRef(opts.onAccepted);
  useEffect(() => {
    homeRef.current = home;
    onAcceptedRef.current = opts.onAccepted;
  });

  const notify = useCallback(
    async (title: string, message: string) => {
      await confirm({ title, message, confirmText: 'OK', hideCancel: true });
    },
    [confirm],
  );

  const askSettings = useCallback(
    async (title: string, message: string) => {
      if (Platform.OS === 'web') {
        await notify(title, `${message}${WEB_SETTINGS_HINT}`);
        return;
      }
      const open = await confirm({ title, message, confirmText: 'Open Settings', cancelText: 'Cancel' });
      if (open) openAppSettings();
    },
    [confirm, notify],
  );

  const present = useCallback(
    async (decision: PunchDecision) => {
      switch (decision.kind) {
        case 'user-missing':
          await notify('Error', 'User not loaded.');
          return;
        case 'plan-blocked':
          await notify('Feature Unavailable', decision.message);
          return;
        case 'register-face':
          setRegistrationOpen(true);
          return;
        case 'register-permissions':
          await askSettings(
            'Permissions Required',
            decision.permanentlyDenied
              ? 'Location and Camera access are required to register your face. Please enable them in Settings.'
              : 'Location and Camera access are needed to register your face.',
          );
          return;
        case 'location-required':
          await askSettings(
            'Location Required',
            'Clockyn needs your location to verify you are within your branch before punching. Please enable Location access in Settings.',
          );
          return;
        case 'location-error':
          await notify('Location Error', 'Unable to get your location. Please check your GPS signal and try again.');
          return;
        case 'check-failed':
          toast.error(decision.message || 'Could not verify your location. Please try again.');
          return;
        case 'outside-area':
          await notify('Outside Branch Area', decision.message);
          return;
        case 'proceed':
          setRecognition({ action: decision.action, coords: decision.coords });
          return;
      }
    },
    [askSettings, notify, toast],
  );

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const h = homeRef.current;
      let registered = h.isFaceRegistered;
      if (h.userId && !plan.isBlocked('camera_punch') && !h.faceStatusKnown) {
        // The face status failed to load: check again instead of wrongly asking an enrolled user to register.
        const fresh = await h.refetchFace();
        if (fresh === undefined) {
          toast.error('Could not check your face registration. Please check your connection and try again.');
          return;
        }
        registered = fresh;
      }
      const decision = await runPunchChecks({
        userId: h.userId,
        planBlocked: plan.isBlocked('camera_punch'),
        planMessage: plan.message('camera_punch') || PLAN_BLOCKED_MESSAGE,
        faceRegistered: registered,
        isPunchedIn: h.today.isPunchedIn,
        getPermission: getPermissionDetail,
        requestPermission,
        getPosition: async () => {
          const p = await getCurrentPosition();
          return { latitude: p.latitude, longitude: p.longitude };
        },
        checkLocation: async (c) => faceApi.checkPunchLocation({ userId: h.userId, latitude: c.latitude, longitude: c.longitude }),
        errorMessage: (e) => getErrorMessage(e, 'Could not verify your location. Please try again.'),
      });
      await present(decision);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }, [plan, present, toast]);

  const onRegistered = useCallback(async () => {
    setRegistrationOpen(false);
    try {
      await homeRef.current.refetchFace();
    } catch {
      // the next focus / poll re-checks
    }
  }, []);

  const onPunchAccepted = useCallback((action: PunchAction, result: PunchResult) => {
    logEvent('AttendanceMarked', { action: action === 'punch_in' ? 'checkin' : 'checkout' });
    void homeRef.current.refetchToday();
    // The attendance calendar (month / day sessions) must not keep showing the day as it was before this punch.
    const userId = homeRef.current.userId;
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all(userId), predicate: (q) => q.queryKey[2] !== 'today' });
    }
    onAcceptedRef.current?.(action, result);
  }, [queryClient]);

  const verifyApplied = useCallback(async (action: PunchAction): Promise<boolean> => {
    try {
      const today = await homeRef.current.refetchToday();
      if (!today) return false;
      return action === 'punch_in' ? today.isPunchedIn : !today.isPunchedIn && today.punchCount > 0;
    } catch {
      return false;
    }
  }, []);

  const closeRegistration = useCallback(() => setRegistrationOpen(false), []);
  const closeRecognition = useCallback(() => setRecognition(null), []);

  return {
    checking,
    registrationOpen,
    recognition,
    start,
    closeRegistration,
    closeRecognition,
    onRegistered,
    onPunchAccepted,
    verifyApplied,
  };
}
