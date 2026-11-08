/**
 * Which FAQ rows are open. A tiny external store instead of React state in the screen: opening or closing one row
 * notifies ONLY that row's subscribers, so the screen and the other rows (hundreds of them) are not rendered again.
 * The screen creates one store, so what is open survives searching and switching bucket (rows unmount, the store stays).
 */
export interface FaqOpenStore {
  isOpen(id: string): boolean;
  toggle(id: string): void;
  /** Subscribes to ONE row; returns the unsubscribe function (the shape `useSyncExternalStore` wants). */
  subscribe(id: string, listener: () => void): () => void;
  /** False when the OS asks for reduced motion: rows then open and close without the layout animation. */
  readonly animate: boolean;
  setAnimate(on: boolean): void;
}

export function createFaqOpenStore(): FaqOpenStore {
  const open = new Set<string>();
  const listeners = new Map<string, Set<() => void>>();
  let animate = true;
  return {
    get animate() {
      return animate;
    },
    setAnimate(on) {
      animate = on;
    },
    isOpen: (id) => open.has(id),
    toggle(id) {
      if (!open.delete(id)) open.add(id);
      listeners.get(id)?.forEach((notify) => notify());
    },
    subscribe(id, listener) {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(id);
      };
    },
  };
}
