/**
 * Permissions — WEB / default implementation (Permissions API, getUserMedia, Notification API).
 * Browsers have no settings deep link: `openAppSettings` shows nothing it can open, so UIs should show
 * "change this in your browser's site settings" copy when `canAskAgain` is false.
 * The native implementation lives in `permissions.native.ts`.
 */
import type { PermissionDetail, PermissionKind, PermissionState } from './permissions.types';

export type { PermissionKind, PermissionState, PermissionDetail } from './permissions.types';

type QueryName = 'geolocation' | 'camera';

async function query(name: QueryName): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
    const res = await navigator.permissions.query({ name: name as PermissionName });
    return res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return null; // e.g. Firefox/Safari do not know the "camera" permission name
  }
}

export async function getPermissionDetail(p: PermissionKind): Promise<PermissionDetail> {
  let status: PermissionState = 'undetermined';
  switch (p) {
    case 'location':
      status = (await query('geolocation')) ?? 'undetermined';
      break;
    case 'camera':
      status = (await query('camera')) ?? 'undetermined';
      break;
    case 'photos':
      status = 'granted'; // the browser file picker needs no permission
      break;
    case 'notifications':
      if (typeof Notification === 'undefined') status = 'denied';
      else status = Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'undetermined';
      break;
  }
  return { status, canAskAgain: status !== 'denied' };
}

export async function checkPermission(p: PermissionKind): Promise<PermissionState> {
  return (await getPermissionDetail(p)).status;
}

export async function requestPermission(p: PermissionKind): Promise<boolean> {
  switch (p) {
    case 'photos':
      return true;
    case 'notifications': {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      try {
        return (await Notification.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    }
    case 'camera': {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        return false;
      }
    }
    case 'location': {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
      return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => resolve(err.code !== 1), // timeout/unavailable still means access was granted
          { timeout: 15_000, maximumAge: 60_000 },
        );
      });
    }
  }
}

/** No-op on the web: browsers expose no deep link to site settings. */
export function openAppSettings(): void {
  /* intentionally empty */
}
