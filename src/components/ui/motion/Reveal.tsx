import React, { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { nativeDriver } from '../internal/web';
import { useReduceMotion } from './useReduceMotion';

export type RevealProps = {
  children: React.ReactNode;
  /** Position in the screen's entrance sequence: each step starts 80 ms after the previous one. */
  index?: number;
  style?: StyleProp<ViewStyle>;
};

/** Fade + rise entrance (plays once on mount). Skipped entirely when the OS asks for reduced motion. */
export function Reveal({ children, index = 0, style }: RevealProps) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduce) {
      progress.setValue(1);
      return undefined;
    }
    const run = Animated.timing(progress, { toValue: 1, duration: 480, delay: 40 + index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: nativeDriver });
    run.start();
    return () => run.stop();
  }, [reduce, index, progress]);

  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}
