/**
 * Group chat colour themes (the only chat preference v1 persisted: `{ [groupId]: index }`, 8 palettes).
 * "Default" follows the app theme tokens (so it is right in light and dark mode); the other seven are fixed
 * accent palettes from the product spec (bubble colours darkened one step so white message text meets 4.5:1; they are chat-content colours chosen by the user, not UI chrome).
 */
import type { ColorTokens } from '@/theme';

export interface ChatThemeColors {
  /** Conversation background. */
  background: string;
  myBubble: string;
  myText: string;
  otherBubble: string;
  otherText: string;
  /** Accent for the send button and header chrome. */
  accent: string;
  /** Composer background. */
  inputBackground: string;
}

interface Palette {
  label: string;
  background: string;
  myBubble: string;
  otherBubble: string;
  myText: string;
  otherText: string;
  inputBackground: string;
}

/** Spec order: index 0 is replaced by the token-driven default. */
const PALETTES: readonly Palette[] = [
  { label: 'Default', background: '', myBubble: '', otherBubble: '', myText: '', otherText: '', inputBackground: '' },
  { label: 'Ocean', background: '#e0f2fe', myBubble: '#0369a1', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#0c4a6e', inputBackground: '#bae6fd' },
  { label: 'Forest', background: '#f0fdf4', myBubble: '#15803d', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#14532d', inputBackground: '#bbf7d0' },
  { label: 'Sunset', background: '#fff7ed', myBubble: '#c2410c', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#7c2d12', inputBackground: '#fed7aa' },
  { label: 'Lavender', background: '#f5f3ff', myBubble: '#7c3aed', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#3b0764', inputBackground: '#ddd6fe' },
  { label: 'Rose', background: '#fff1f2', myBubble: '#e11d48', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#881337', inputBackground: '#fecdd3' },
  { label: 'Dark', background: '#0a0a0a', myBubble: '#f5f5f5', otherBubble: '#1a1a1a', myText: '#0a0a0a', otherText: '#f5f5f5', inputBackground: '#1a1a1a' },
  { label: 'Teal', background: '#f0fdfa', myBubble: '#0f766e', otherBubble: '#ffffff', myText: '#ffffff', otherText: '#134e4a', inputBackground: '#99f6e4' },
];

export const CHAT_THEME_COUNT = PALETTES.length;
export const DEFAULT_CHAT_THEME = 0;

export const chatThemeLabel = (index: number): string => PALETTES[normalizeThemeIndex(index)].label;

/** Persisted values are untrusted: anything that is not an index of a known theme becomes the default. */
export function normalizeThemeIndex(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n < PALETTES.length ? n : DEFAULT_CHAT_THEME;
}

export function resolveChatTheme(index: number, colors: ColorTokens): ChatThemeColors {
  const i = normalizeThemeIndex(index);
  const p = PALETTES[i];
  if (i === DEFAULT_CHAT_THEME) {
    return {
      background: colors.background,
      myBubble: colors.primary,
      myText: colors.onPrimary,
      otherBubble: colors.surfaceElevated,
      otherText: colors.text,
      accent: colors.primary,
      inputBackground: colors.surfaceMuted,
    };
  }
  return {
    background: p.background,
    myBubble: p.myBubble,
    myText: p.myText,
    otherBubble: p.otherBubble,
    otherText: p.otherText,
    accent: p.myBubble,
    inputBackground: p.inputBackground,
  };
}

/** `{ [groupId]: index }` from the persisted JSON, dropping anything malformed. */
export function sanitizeThemeMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isInteger(n) && n >= 0 && n < PALETTES.length) out[k] = n;
  }
  return out;
}
