/**
 * Small, non-persisted UI state shared between layers that cannot import each other.
 */
import { create } from 'zustand';

/** `expired`: the server rejected the session token (401); the app shows a toast, not a welcome-screen notice. */
export type SignOutReason = 'logout' | 'forced' | 'deleted' | 'expired';

interface UiState {
  /** Why the last sign-out happened — the welcome screen shows a notice for `forced` / `deleted`, then clears it. */
  signOutNotice: SignOutReason | null;
  setSignOutNotice: (reason: SignOutReason | null) => void;
  clearSignOutNotice: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  signOutNotice: null,
  setSignOutNotice: (signOutNotice) => set({ signOutNotice }),
  clearSignOutNotice: () => set({ signOutNotice: null }),
}));

/** Text for the welcome-screen notice (null when nothing to say). */
export function signOutNoticeMessage(reason: SignOutReason | null): string | null {
  switch (reason) {
    case 'forced':
      return 'You were signed out because your account was used on another device.';
    case 'deleted':
      return 'Your account has been removed.';
    default:
      return null;
  }
}
