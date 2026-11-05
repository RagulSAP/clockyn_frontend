/**
 * Haptics — WEB / default implementation: `navigator.vibrate` where supported (Android browsers),
 * silently nothing elsewhere. The native implementation lives in `haptics.native.ts`.
 */
export type ImpactStrength = 'light' | 'medium' | 'heavy';
export type NotificationHaptic = 'success' | 'warning' | 'error';

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* unsupported / blocked */
  }
}

export function hapticImpact(strength: ImpactStrength = 'light'): void {
  vibrate(strength === 'heavy' ? 30 : strength === 'medium' ? 20 : 10);
}

export function hapticNotification(type: NotificationHaptic): void {
  vibrate(type === 'success' ? [10, 40, 10] : type === 'warning' ? [20, 40, 20] : [30, 40, 30, 40, 30]);
}

export function hapticSelection(): void {
  vibrate(5);
}
