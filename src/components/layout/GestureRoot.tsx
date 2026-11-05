import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Web: a plain View. The gesture-handler barrel drags the whole animation runtime (~1 MB) into the web
 * bundle and nothing on the web needs it (see `GestureRoot.native.tsx`).
 */
export function GestureRoot({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={style}>{children}</View>;
}
