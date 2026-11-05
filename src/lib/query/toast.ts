/**
 * Lazy bridge to the design-system toast (`useToast` from `@/components/ui`).
 *
 * The query/hooks layer sits below the UI layer, so it must not import the UI at module load (cycles, and it keeps
 * unit tests free of React Native components). The module is required on first use; when it is unavailable the
 * bridge degrades to a no-op instead of crashing.
 */
export interface ToastLike {
  success: (message: string) => unknown;
  error: (message: string) => unknown;
  info: (message: string) => unknown;
}

type UiModule = { useToast?: () => ToastLike; toast?: ToastLike };

const NOOP_TOAST: ToastLike = { success: () => undefined, error: () => undefined, info: () => undefined };

let ui: UiModule | null | undefined;

function loadUi(): UiModule | null {
  if (ui !== undefined) return ui;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ui = require('@/components/ui') as UiModule;
  } catch {
    ui = null;
  }
  return ui;
}

/** Test hook: forget the cached module. */
export function __resetToastBridge(): void {
  ui = undefined;
}

/** Hook: the app toast (stable between renders). Safe to call unconditionally. */
export function useAppToast(): ToastLike {
  const mod = loadUi();
  // `useToast` presence is fixed for the lifetime of the process, so the hook order is stable.
  const fromHook = mod?.useToast ? mod.useToast() : undefined;
  return fromHook ?? mod?.toast ?? NOOP_TOAST;
}

/** Imperative toast for non-React code; no-op when the UI layer is unavailable. */
export function getAppToast(): ToastLike {
  return loadUi()?.toast ?? NOOP_TOAST;
}
