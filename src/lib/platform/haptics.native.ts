/** Haptics — NATIVE implementation (expo-haptics). All calls are fire-and-forget and never throw. */
import * as Haptics from 'expo-haptics';

export type ImpactStrength = 'light' | 'medium' | 'heavy';
export type NotificationHaptic = 'success' | 'warning' | 'error';

const IMPACT = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
} as const;

const NOTIFICATION = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
} as const;

export function hapticImpact(strength: ImpactStrength = 'light'): void {
  Haptics.impactAsync(IMPACT[strength]).catch(() => undefined);
}

export function hapticNotification(type: NotificationHaptic): void {
  Haptics.notificationAsync(NOTIFICATION[type]).catch(() => undefined);
}

export function hapticSelection(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
