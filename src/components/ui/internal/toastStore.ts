import { useSyncExternalStore } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  /** Auto-dismiss delay in ms (default 3500; errors 5000). 0 keeps it until tapped. */
  duration?: number;
  title?: string;
  action?: { label: string; onPress: () => void };
};

export type ToastItemData = {
  id: number;
  kind: ToastKind;
  message: string;
  title?: string;
  duration: number;
  action?: { label: string; onPress: () => void };
};

const MAX_VISIBLE = 3;
let items: ToastItemData[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function show(kind: ToastKind, message: string, opts: ToastOptions = {}): number {
  const text = (message ?? '').toString().trim();
  if (!text) return -1;
  const existing = items.find((t) => t.kind === kind && t.message === text);
  if (existing) return existing.id; // de-duplicate identical toasts
  const id = nextId++;
  const item: ToastItemData = {
    id,
    kind,
    message: text,
    title: opts.title,
    action: opts.action,
    duration: opts.duration ?? (kind === 'error' ? 5000 : 3500),
  };
  items = [...items, item].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function removeToast(id: number): void {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

export function clearToasts(): void {
  if (items.length) {
    items = [];
    emit();
  }
}

/** Imperative API (also usable outside React, e.g. in query error handlers). */
export const toast = {
  success: (message: string, opts?: ToastOptions) => show('success', message, opts),
  error: (message: string, opts?: ToastOptions) => show('error', message, opts),
  info: (message: string, opts?: ToastOptions) => show('info', message, opts),
  warning: (message: string, opts?: ToastOptions) => show('warning', message, opts),
  show,
  dismiss: removeToast,
  clear: clearToasts,
};

export type ToastApi = typeof toast;

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const getSnapshot = () => items;

export function useToastItems(): ToastItemData[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
