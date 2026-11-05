import type { IconName } from '@/components/ui';
import type { PermissionDetail, PermissionKind } from '@/lib/platform/permissions';

export interface PermissionMeta {
  kind: PermissionKind;
  label: string;
  description: string;
  icon: IconName;
}

export const PERMISSIONS: readonly PermissionMeta[] = [
  { kind: 'location', label: 'Location', description: 'GPS check-in & attendance tracking', icon: 'map-pin' },
  { kind: 'camera', label: 'Camera', description: 'Face recognition & photo capture', icon: 'camera' },
  { kind: 'notifications', label: 'Notifications', description: 'Alerts, reminders & updates', icon: 'bell' },
  { kind: 'photos', label: 'Photos', description: 'Attach images to requests and expenses', icon: 'image' },
];

export type PermissionMap = Record<PermissionKind, PermissionDetail>;

export const UNKNOWN_PERMISSIONS: PermissionMap = {
  location: { status: 'undetermined', canAskAgain: true },
  camera: { status: 'undetermined', canAskAgain: true },
  notifications: { status: 'undetermined', canAskAgain: true },
  photos: { status: 'undetermined', canAskAgain: true },
};

export function countGranted(map: PermissionMap): number {
  return PERMISSIONS.filter((p) => map[p.kind].status === 'granted').length;
}

/**
 * What tapping a permission card does:
 *  - `none`: already granted (nothing to do),
 *  - `request`: the system prompt can still be shown,
 *  - `open-settings`: blocked on a native OS → open the app's settings page,
 *  - `browser-instructions`: blocked in a browser → explain how to change the site setting (no deep link exists).
 */
export type PermissionAction = 'none' | 'request' | 'open-settings' | 'browser-instructions';

export function permissionAction(detail: PermissionDetail, os: string): PermissionAction {
  if (detail.status === 'granted') return 'none';
  if (detail.status === 'undetermined' || detail.canAskAgain) return 'request';
  return os === 'web' ? 'browser-instructions' : 'open-settings';
}
