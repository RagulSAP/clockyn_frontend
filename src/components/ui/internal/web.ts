import { Platform, type ViewStyle } from 'react-native';

/**
 * Web-only interaction helpers. We show the focus ring only for keyboard focus (like `:focus-visible`):
 * a document-level listener tracks whether the last interaction was keyboard or pointer.
 */
let keyboardModality = false;
let installed = false;

function install(): void {
  if (installed || Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      keyboardModality = true;
    }
  };
  const onPointer = () => {
    keyboardModality = false;
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onPointer, true);
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('touchstart', onPointer, true);
}

/** True only on web, for an element that is focused via keyboard navigation. */
export function isKeyboardFocus(focused: boolean | undefined): boolean {
  if (Platform.OS !== 'web') return false;
  install();
  return !!focused && keyboardModality;
}

export function focusRing(color: string, radius?: number): ViewStyle {
  return {
    outlineStyle: 'solid',
    outlineWidth: 2,
    outlineColor: color,
    outlineOffset: 2,
    ...(radius !== undefined ? { borderRadius: radius } : null),
  } as ViewStyle;
}

/** Style that removes the browser's default input outline (we draw our own focus state). */
export const noOutline = Platform.select<object>({ web: { outlineStyle: 'none', outlineWidth: 0 }, default: {} }) as object;

export const isWeb = Platform.OS === 'web';
/** Animated native driver is unavailable on web (react-native-web falls back to JS and warns). */
export const nativeDriver = Platform.OS !== 'web';
