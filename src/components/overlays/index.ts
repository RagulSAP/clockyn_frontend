// Shared app-level overlays. Import from '@/components/overlays'.
export { RateAppModal, rateCtaLabel } from './RateAppModal';
export type { RateAppModalProps } from './RateAppModal';
export { useRatePrompt } from '@/lib/rateApp';

export { PermissionOnboarding } from './PermissionOnboarding';
export type { PermissionOnboardingProps } from './PermissionOnboarding';
export { usePermissionOnboarding, isOnboardingDone, markOnboardingDone, resetOnboarding, onboardingKeyFor, ONBOARDING_DELAY_MS } from './usePermissionOnboarding';
export { ONBOARDING_STEPS, ONBOARDING_INTRO } from './permissionCopy';
export type { OnboardingRole, OnboardingStep } from './permissionCopy';
