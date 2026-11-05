import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/** Native: root view required by gesture-handler (used by react-native-screens' gestures). */
export function GestureRoot({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <GestureHandlerRootView style={style}>{children}</GestureHandlerRootView>;
}
