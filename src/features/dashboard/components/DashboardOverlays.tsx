import React from "react";

import {
  PermissionOnboarding,
  RateAppModal,
  usePermissionOnboarding,
  useRatePrompt,
} from "@/components/overlays";

/**
 * App-level overlays hosted by the admin home: the one-time permission intro and the rate-the-app prompt (the
 * prompt waits until the intro has been dismissed so two dialogs never stack).
 */
export function DashboardOverlays() {
  const onboarding = usePermissionOnboarding();
  const rate = useRatePrompt();
  return (
    <>
      <PermissionOnboarding
        visible={onboarding.visible}
        role="admin"
        onComplete={onboarding.complete}
      />
      <RateAppModal
        visible={rate.visible && !onboarding.visible}
        onClose={rate.close}
      />
    </>
  );
}
