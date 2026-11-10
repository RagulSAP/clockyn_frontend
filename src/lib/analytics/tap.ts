/**
 * Button taps reach the clickstream through this tiny, dependency-free hook point, so the UI kit never imports the
 * network layer. `useClickstream` installs the handler while someone is signed in; with none installed a tap costs nothing.
 */
let handler: ((label: unknown) => void) | null = null;

export function setTapHandler(next: ((label: unknown) => void) | null): void {
  handler = next;
}

/** A tap on a button / icon button, by its label. Never throws. */
export function trackTap(label: unknown): void {
  try {
    handler?.(label);
  } catch {
    /* analytics must never break a tap */
  }
}
