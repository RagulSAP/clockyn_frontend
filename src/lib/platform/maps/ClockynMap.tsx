/**
 * Type-resolution entry for `ClockynMap`. At runtime Metro picks `ClockynMap.native.tsx` on Android/iOS
 * and `ClockynMap.web.tsx` on web; this file only gives TypeScript (and any non-platform bundler) a default.
 */
export { ClockynMap } from './ClockynMap.web';
