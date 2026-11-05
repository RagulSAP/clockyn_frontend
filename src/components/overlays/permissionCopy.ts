import type { IconName } from '@/components/ui';
import { brand } from '@/config/brand';
import type { PermissionKind } from '@/lib/platform/permissions';

export type OnboardingRole = 'admin' | 'staff';

export type OnboardingStep = {
  kind: PermissionKind;
  icon: IconName;
  title: string;
  /** Requested from the onboarding itself (only notifications); the others are asked at the point of use. */
  requiresUpfront: boolean;
  description: Record<OnboardingRole, string>;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    kind: 'location',
    icon: 'map-pin',
    title: 'Location Access',
    requiresUpfront: false,
    description: {
      admin:
        "Used to set precise GPS coordinates when you add or edit a branch, and to view your staff's live location on the map. You'll be asked to allow this when you use those screens.",
      staff: "Used to verify your attendance location when you punch in or out. You'll be asked to allow this the first time you punch.",
    },
  },
  {
    kind: 'camera',
    icon: 'camera',
    title: 'Camera Access',
    requiresUpfront: false,
    description: {
      admin:
        "Used to update your organization's profile photo and to attach photos when chatting with your team. You'll be asked to allow this when you use those features.",
      staff: "Used for face recognition and capturing attendance verification photos. You'll be asked to allow this when you register your face.",
    },
  },
  {
    kind: 'notifications',
    icon: 'bell',
    title: 'Notifications',
    requiresUpfront: true,
    description: {
      admin: 'Allow notifications to get alerts on staff requests, subscription renewals, and other important updates for your organization.',
      staff: 'Allow notifications to receive attendance reminders, shift updates, and important alerts from your organization.',
    },
  },
  {
    kind: 'photos',
    icon: 'image',
    title: 'Photo Library',
    requiresUpfront: false,
    description: {
      admin:
        "Used to upload your organization's logo, staff documents, and photos from your gallery. You'll be asked to allow this when you pick a photo.",
      staff: "Used to upload profile pictures and documents from your gallery. You'll be asked to allow this when you pick a photo.",
    },
  },
];

export const ONBOARDING_INTRO = {
  title: 'App Permissions',
  subtitle: {
    admin: `${brand.name} needs a few permissions to help you manage your organization smoothly.`,
    staff: `${brand.name} needs a few permissions to work properly for attendance tracking.`,
  } satisfies Record<OnboardingRole, string>,
  info: {
    admin: 'Each permission is only requested when you actually use that feature — nothing is asked for upfront, except Notifications.',
    staff:
      'Each permission is only requested when you actually use that feature — for example, Location is requested the moment you tap Punch In. Nothing is asked for upfront, except Notifications.',
  } satisfies Record<OnboardingRole, string>,
  chips: ['Location', 'Camera', 'Notifications', 'Photo Library'],
} as const;

export const ONBOARDING_FEATURE_CHIPS: readonly { icon: IconName; label: string }[] = [
  { icon: 'lock', label: 'Secure & Private' },
  { icon: 'shield-check', label: 'Data Protected' },
  { icon: 'eye-off', label: 'Revoke Anytime' },
];
