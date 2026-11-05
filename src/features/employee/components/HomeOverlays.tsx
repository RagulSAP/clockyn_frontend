import React from 'react';

import { PermissionOnboarding, RateAppModal, usePermissionOnboarding, useRatePrompt } from '@/components/overlays';

import { useTodayBirthdays } from '../hooks/useTodayBirthdays';
import type { EmployeeHomeData } from '../hooks/useEmployeeHome';
import type { PunchFlow } from '../hooks/usePunchFlow';
import { BirthdayModal } from './HomeParts';
import { FaceRecognitionModal } from './FaceRecognitionModal';
import { FaceRegistrationModal } from './FaceRegistrationModal';

/**
 * Every modal of the employee home: face registration / recognition, birthday popup, permission onboarding and the
 * rate prompt (shared overlays). Only one popup shows at a time: onboarding first, then birthdays, then the rate
 * prompt, and none while a face camera is open (v1 could open the rate prompt over the punch result).
 * The update prompt lives in the app shell and is not duplicated here.
 */
export function HomeOverlays({ home, punch }: { home: EmployeeHomeData; punch: PunchFlow }) {
  const onboarding = usePermissionOnboarding();
  const rate = useRatePrompt();
  const birthdays = useTodayBirthdays();

  const cameraOpen = punch.registrationOpen || punch.recognition !== null;
  const showOnboarding = onboarding.visible && !cameraOpen;
  const showBirthday = birthdays.open && !cameraOpen && !onboarding.visible;
  const showRate = rate.visible && !cameraOpen && !onboarding.visible && !birthdays.open;

  return (
    <>
      <FaceRegistrationModal
        visible={punch.registrationOpen && home.userId !== ''}
        onClose={punch.closeRegistration}
        userId={home.userId}
        orgId={home.orgId}
        onSuccess={punch.onRegistered}
      />
      <FaceRecognitionModal
        visible={punch.recognition !== null}
        onClose={punch.closeRecognition}
        userId={home.userId}
        orgId={home.orgId}
        action={punch.recognition?.action ?? 'punch_in'}
        coords={punch.recognition?.coords}
        onSuccess={(result, action) => punch.onPunchAccepted(action, result)}
        verifyApplied={punch.verifyApplied}
      />
      <BirthdayModal visible={showBirthday} names={birthdays.names} onClose={birthdays.close} />
      <PermissionOnboarding visible={showOnboarding} role="staff" onComplete={onboarding.complete} />
      <RateAppModal visible={showRate} onClose={rate.close} />
    </>
  );
}
