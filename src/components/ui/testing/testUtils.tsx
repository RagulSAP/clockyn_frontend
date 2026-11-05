import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme';

/** Render inside the Clockyn theme (AsyncStorage is mocked in jest.setup.ts). The wrapper survives `rerender`. */
export function renderThemed(ui: React.ReactElement) {
  return render(ui, { wrapper: ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider> });
}

type JsonNode = { type?: string; children?: (JsonNode | string)[] | null } | string | null;

/** Count host elements of a given type in a `toJSON()` tree (avoids stringifying circular props). */
export function countHostType(node: JsonNode | JsonNode[], type: string): number {
  if (!node || typeof node === 'string') return 0;
  if (Array.isArray(node)) return node.reduce<number>((n, c) => n + countHostType(c, type), 0);
  const own = node.type === type ? 1 : 0;
  return own + (node.children ?? []).reduce<number>((n, c) => n + countHostType(c as JsonNode, type), 0);
}
