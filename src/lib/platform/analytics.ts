/**
 * Typed product-analytics events behind a provider interface. The default provider is a no-op, so calling
 * `logEvent` is always safe (Expo Go, web, tests). A real SDK (or a web pixel) is plugged in with
 * `setAnalyticsProvider` — no SDK identifiers live in the source.
 *
 * Event names/trigger points are the ones marketing relies on (kept from the previous generation):
 *  AppOpened (cold start) · LoginSuccess · CompleteRegistration · AttendanceMarked {action} · Subscribe.
 */

export type AnalyticsEvents = {
  AppOpened: undefined;
  LoginSuccess: undefined;
  CompleteRegistration: undefined;
  /** `checkin` / `checkout` of a successful punch. */
  AttendanceMarked: { action: 'checkin' | 'checkout' };
  /** After a verified subscription payment. */
  Subscribe: undefined;
};

export type AnalyticsEventName = keyof AnalyticsEvents;

export type AnalyticsParams<E extends AnalyticsEventName> = AnalyticsEvents[E];

export interface AnalyticsProvider {
  logEvent(name: string, params?: Record<string, string | number | boolean>): void;
}

const noopProvider: AnalyticsProvider = { logEvent: () => undefined };
let provider: AnalyticsProvider = noopProvider;

/** Installs the analytics backend; pass `null` to restore the no-op provider. */
export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next ?? noopProvider;
}

/** Fire-and-forget; never throws (a faulty provider must not break a user flow). */
export function logEvent<E extends AnalyticsEventName>(
  ...args: AnalyticsEvents[E] extends undefined ? [name: E] : [name: E, params: AnalyticsEvents[E]]
): void {
  const [name, params] = args as [E, Record<string, string | number | boolean> | undefined];
  try {
    provider.logEvent(name, params);
  } catch {
    /* analytics must never affect the app */
  }
}
