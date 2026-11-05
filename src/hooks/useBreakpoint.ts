import { useWindowDimensions } from 'react-native';
import { breakpoints } from '@/theme';

export type Breakpoint = {
  /** width < 768 */
  isPhone: boolean;
  /** 768 <= width < 1100 */
  isTablet: boolean;
  /** width >= 1100 */
  isDesktop: boolean;
  /** width >= 768 (tablet or desktop) */
  isWide: boolean;
  width: number;
  height: number;
};

/** Pure classification, exported for tests and non-hook callers. */
export function getBreakpoint(width: number, height = 0): Breakpoint {
  const isDesktop = width >= breakpoints.desktop;
  const isTablet = !isDesktop && width >= breakpoints.tablet;
  return { isPhone: !isDesktop && !isTablet, isTablet, isDesktop, isWide: isDesktop || isTablet, width, height };
}

/** Responsive helper: `{ isPhone, isTablet, isDesktop, width }` (plus `isWide`, `height`). */
export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();
  return getBreakpoint(width, height);
}
