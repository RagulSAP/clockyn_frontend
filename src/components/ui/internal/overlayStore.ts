import { useSyncExternalStore } from 'react';

/**
 * Tracks which overlays (Modal / BottomSheet) are open so the toast layer can render *inside* the
 * top-most one. Native modals live in their own window, so a toast mounted at the app root would be
 * hidden behind them; each overlay therefore hosts its own toast layer while it is the top-most.
 */
let stack: number[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Reserve an id (pure; safe to call during render). Register it with `pushOverlay` while the overlay is open. */
export function allocOverlayId(): number {
  return nextId++;
}

export function pushOverlay(id: number): void {
  if (stack.includes(id)) return;
  stack = [...stack, id];
  emit();
}

export function popOverlay(id: number): void {
  stack = stack.filter((x) => x !== id);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getTop = () => (stack.length ? stack[stack.length - 1] : null);

/** Id of the top-most open overlay, or null when none is open. */
export function useTopOverlay(): number | null {
  return useSyncExternalStore(subscribe, getTop, getTop);
}
