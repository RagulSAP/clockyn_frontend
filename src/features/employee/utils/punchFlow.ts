/**
 * Pre-punch checks of the employee home, in the spec's ORDER (pure orchestration over injected dependencies, unit-tested):
 *
 *   1. user loaded            -> `user-missing`
 *   2. plan `camera_punch`    -> `plan-blocked`
 *   3. face not registered    -> permissions (location + camera) -> `register-face` | `register-permissions`
 *   4. location permission    -> GPS fix                          -> `location-required` | `location-error`
 *   5. branch geofence        -> `check-failed` (request error, v1 swallowed it) | `outside-area`
 *   6. all good               -> `proceed` (open the face camera with the checked coordinates)
 */
import type { PermissionDetail, PermissionKind } from '@/lib/platform/permissions';
import type { PunchAction } from '@/types/api/face';

export interface Coords {
  latitude: number;
  longitude: number;
}

export type PunchDecision =
  | { kind: 'user-missing' }
  | { kind: 'plan-blocked'; message: string }
  | { kind: 'register-face' }
  | { kind: 'register-permissions'; permanentlyDenied: boolean }
  | { kind: 'location-required' }
  | { kind: 'location-error' }
  | { kind: 'check-failed'; message: string }
  | { kind: 'outside-area'; message: string }
  | { kind: 'proceed'; action: PunchAction; coords: Coords };

export interface PunchCheckDeps {
  userId: string;
  /** `camera_punch` plan gate. */
  planBlocked: boolean;
  planMessage: string;
  faceRegistered: boolean;
  isPunchedIn: boolean;
  getPermission: (kind: PermissionKind) => Promise<PermissionDetail>;
  requestPermission: (kind: PermissionKind) => Promise<boolean>;
  /** Resolves a GPS fix; rejects (any reason) when none is available. */
  getPosition: () => Promise<Coords>;
  /** Geofence check; rejects on request failure. */
  checkLocation: (coords: Coords) => Promise<{ allowed: boolean; message: string }>;
  /** Turns a thrown error into user text. */
  errorMessage: (error: unknown) => string;
}

async function registrationPermissions(deps: PunchCheckDeps): Promise<PunchDecision> {
  const [loc, cam] = await Promise.all([deps.getPermission('location'), deps.getPermission('camera')]);
  if (loc.status === 'granted' && cam.status === 'granted') return { kind: 'register-face' };
  const blockedForever = (loc.status !== 'granted' && !loc.canAskAgain) || (cam.status !== 'granted' && !cam.canAskAgain);
  if (blockedForever) return { kind: 'register-permissions', permanentlyDenied: true };
  const locOk = loc.status === 'granted' || (await deps.requestPermission('location'));
  const camOk = cam.status === 'granted' || (await deps.requestPermission('camera'));
  return locOk && camOk ? { kind: 'register-face' } : { kind: 'register-permissions', permanentlyDenied: false };
}

export async function runPunchChecks(deps: PunchCheckDeps): Promise<PunchDecision> {
  if (!deps.userId) return { kind: 'user-missing' };
  if (deps.planBlocked) return { kind: 'plan-blocked', message: deps.planMessage };
  if (!deps.faceRegistered) return registrationPermissions(deps);

  // Location permission (requested when not yet granted), then the GPS fix.
  const permission = await deps.getPermission('location');
  if (permission.status !== 'granted') await deps.requestPermission('location');
  let coords: Coords | null = null;
  try {
    coords = await deps.getPosition();
  } catch {
    coords = null;
  }
  if (!coords) {
    const again = await deps.getPermission('location');
    return again.status !== 'granted' ? { kind: 'location-required' } : { kind: 'location-error' };
  }

  let check: { allowed: boolean; message: string };
  try {
    check = await deps.checkLocation(coords);
  } catch (e) {
    return { kind: 'check-failed', message: deps.errorMessage(e) };
  }
  if (!check.allowed) return { kind: 'outside-area', message: check.message };
  return { kind: 'proceed', action: deps.isPunchedIn ? 'punch_out' : 'punch_in', coords };
}
