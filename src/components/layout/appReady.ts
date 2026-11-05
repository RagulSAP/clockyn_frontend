/** Splash gate: when the app may show its first real screen. Pure so it is unit-tested. */
export const SPLASH_SAFETY_TIMEOUT_MS = 6000;

/**
 * Ready when fonts have settled (loaded, or failed — a missing font must never trap the app on the splash) AND
 * the persisted session has been read. A safety timeout lifts the gate regardless so a hung font/storage read
 * can never leave a blank screen; guarded screens then show their own loaders until hydration completes.
 */
export function isAppReady(input: { fontsLoaded: boolean; fontError: boolean; hydrated: boolean; timedOut: boolean }): boolean {
  if (input.timedOut) return true;
  return (input.fontsLoaded || input.fontError) && input.hydrated;
}
