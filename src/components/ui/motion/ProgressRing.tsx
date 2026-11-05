import React, { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useReduceMotion } from './useReduceMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SWEEP_MS = 850;

export type ProgressRingProps = {
  /** Target share, 0..1. The arc sweeps to it on mount and whenever it changes. */
  progress: number;
  color: string;
  /** Colour of the unfilled track. */
  track: string;
  size?: number;
  stroke?: number;
  /** Start delay in ms (use to stagger several rings). */
  delay?: number;
  /** Rendered in the middle of the ring. */
  children?: React.ReactNode;
};

/**
 * Circular progress ring with an animated sweep. The arc is driven through an animated SVG attribute, so no React
 * render happens per frame. Honours reduced motion.
 */
export function ProgressRing({ progress, color, track, size = 100, stroke = 9, delay = 0, children }: ProgressRingProps) {
  const reduceMotion = useReduceMotion();
  const [value] = useState(() => new Animated.Value(0));
  const target = Math.min(1, Math.max(0, progress));

  useEffect(() => {
    if (reduceMotion) {
      value.setValue(target);
      return undefined;
    }
    const run = Animated.timing(value, { toValue: target, duration: SWEEP_MS, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    run.start();
    return () => run.stop();
  }, [target, delay, reduceMotion, value]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={mid} cy={mid} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={mid}
          cy={mid}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={value.interpolate({ inputRange: [0, 1], outputRange: [c, 0], extrapolate: 'clamp' })}
          // a zero-length round cap would draw a dot: hide the arc until it has some length
          strokeOpacity={value.interpolate({ inputRange: [0, 0.004], outputRange: [0, 1], extrapolate: 'clamp' })}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
