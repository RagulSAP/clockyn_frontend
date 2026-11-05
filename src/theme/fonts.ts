import type { FontSource } from 'expo-font';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Outfit_800ExtraBold } from '@expo-google-fonts/outfit/800ExtraBold';
import { fontFamily } from './tokens';

/**
 * Font map for `useFonts(clockynFontMap)` in the root layout. Keys match `tokens.fontFamily` values.
 * Only the five weights the type scale uses are bundled (per-weight imports avoid shipping all 18 files).
 */
export const clockynFontMap: Record<(typeof fontFamily)[keyof typeof fontFamily], FontSource> = {
  [fontFamily.regular]: Outfit_400Regular,
  [fontFamily.medium]: Outfit_500Medium,
  [fontFamily.semibold]: Outfit_600SemiBold,
  [fontFamily.bold]: Outfit_700Bold,
  [fontFamily.extrabold]: Outfit_800ExtraBold,
};
