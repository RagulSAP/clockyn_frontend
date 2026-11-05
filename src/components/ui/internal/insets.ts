import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export type Insets = { top: number; right: number; bottom: number; left: number };
const ZERO: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Safe-area insets that degrade to zeros when no SafeAreaProvider is mounted (tests, isolated stories). */
export function useInsets(): Insets {
  return useContext(SafeAreaInsetsContext) ?? ZERO;
}
