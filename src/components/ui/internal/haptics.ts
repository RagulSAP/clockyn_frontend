import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

/**
 * Fire-and-forget haptic feedback. Guarded for web (no vibration API contract) and swallows device
 * errors (e.g. simulators, unsupported hardware) so a missing haptic engine can never break a press.
 */
export function haptic(kind: HapticKind = 'light'): void {
  if (Platform.OS === 'web') return;
  try {
    switch (kind) {
      case 'selection':
        void Haptics.selectionAsync().catch(() => {});
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      default:
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  } catch {
    /* haptics unavailable */
  }
}
