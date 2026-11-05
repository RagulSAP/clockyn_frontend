import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { spacing, useTheme } from '@/theme';

import { IconButton } from '../Button';
import { nativeDriver } from '../internal/web';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Web only: CSS scroll snapping (RN-web has no snapToInterval). */
const WEB_SNAP_SCROLLER = Platform.select({ web: { scrollSnapType: 'x mandatory', scrollPaddingLeft: 16 } as object, default: {} });
const WEB_SNAP_ITEM = Platform.select({ web: { scrollSnapAlign: 'start' } as object, default: {} });

export type SnapCarouselItemInfo = {
  index: number;
  /** Distance (in items) from the focused item: 0 for the focused one. */
  depth: number;
  /** Scroll offset in px. Interpolate over `[(index - 1) * step, index * step, (index + 1) * step]` for focus effects. */
  scrollX: Animated.Value;
  /** Distance in px between two neighbouring item origins (item width minus overlap). */
  step: number;
};

export type SnapCarouselProps<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  itemWidth: number;
  /** Px each item tucks under its neighbour (a deck look). Default 0. Keep it below the item's inner padding. */
  overlap?: number;
  /** Space between items when they do not overlap. Default 14. */
  gap?: number;
  renderItem: (item: T, info: SnapCarouselItemInfo) => React.ReactNode;
  /** Animated transform / opacity for an item (typically interpolated from `scrollX`). */
  itemStyle?: (info: SnapCarouselItemInfo) => Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  /** Accessibility label of a pagination dot, e.g. `Show Absent`. */
  dotLabel: (item: T) => string;
  /** Colour of the focused dot (a function receives the focused index). */
  accent: string | ((index: number) => string);
  /** Keep in line with the parent card's padding: the scroller bleeds to the card edges by this much. */
  edgeInset?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Auto-advances through items on a timer; stops permanently on user touch. */
  autoPlay?: boolean;
  /** Interval between auto-advances in ms. Default 2800. */
  autoPlayInterval?: number;
  testID?: string;
  dotsTestID?: string;
  prevTestID?: string;
  nextTestID?: string;
  prevLabel?: string;
  nextLabel?: string;
};

/** Pagination dot: the focused one stretches into a pill and pulses gently. */
function Dot({ active, color, track, label, onPress }: { active: boolean; color: string; track: string; label: string; onPress: () => void }) {
  const [width] = useState(() => new Animated.Value(active ? 20 : 6));
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.timing(width, { toValue: active ? 20 : 6, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [active, width]);

  useEffect(() => {
    if (!active) {
      scale.stopAnimation();
      Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.35, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [active, scale]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress}>
      <Animated.View style={{ width, height: 6, borderRadius: 3, backgroundColor: active ? color : track, transform: [{ scaleY: scale }] }} />
    </Pressable>
  );
}

/**
 * Horizontal swipe carousel that snaps item by item, left-aligned with the next item peeking in. Items can tuck under
 * each other (`overlap`) and react to the scroll position (`itemStyle`). Dots show the position; web also gets arrow
 * buttons (mouse users cannot swipe). Lay it out inside a padded Card / screen section: it bleeds to the section edges.
 */
export function SnapCarousel<T>({
  data,
  keyExtractor,
  itemWidth,
  overlap = 0,
  gap = 14,
  renderItem,
  itemStyle,
  dotLabel,
  accent,
  edgeInset = spacing.lg,
  paddingTop = spacing.sm,
  paddingBottom = spacing.xs,
  autoPlay = false,
  autoPlayInterval = 2800,
  testID,
  dotsTestID,
  prevTestID,
  nextTestID,
  prevLabel = 'Previous',
  nextLabel = 'Next',
}: SnapCarouselProps<T>) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  const [scrollX] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  // Space after each item: the gap, or minus the overlap when items tuck under each other.
  const after = overlap > 0 ? -overlap : gap;
  const step = itemWidth + after;
  const last = data.length - 1;
  // The trailing pad lets the last item scroll all the way to the left edge too, so every item can be the focused one.
  const endPad = Math.max(edgeInset, width - edgeInset - itemWidth - after);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: nativeDriver,
    listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(clamp(Math.round(e.nativeEvent.contentOffset.x / step), 0, last)),
  });

  // ── auto-play ────────────────────────────────────────────────────────────────
  const autoPlayPausedRef = useRef(false);
  const indexRef = useRef(0);
  const stepRef = useRef(step);
  const lastRef = useRef(last);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { lastRef.current = last; }, [last]);
  useEffect(() => { indexRef.current = index; }, [index]);

  const stopAutoPlay = useCallback(() => { autoPlayPausedRef.current = true; }, []);

  useEffect(() => {
    if (!autoPlay || data.length <= 1) return;
    const id = setInterval(() => {
      if (autoPlayPausedRef.current) return;
      const next = indexRef.current >= lastRef.current ? 0 : indexRef.current + 1;
      scroller.current?.scrollTo({ x: next * stepRef.current, animated: true });
      indexRef.current = next;
      setIndex(next);
    }, autoPlayInterval);
    return () => clearInterval(id);
  }, [autoPlay, autoPlayInterval, data.length]);

  const goTo = useCallback(
    (i: number) => {
      stopAutoPlay();
      const target = clamp(i, 0, last);
      scroller.current?.scrollTo({ x: target * step, animated: true });
      setIndex(target);
    },
    [last, step, stopAutoPlay],
  );

  const showArrows = Platform.OS === 'web' && width > 0;
  const activeColor = typeof accent === 'function' ? accent(index) : accent;

  return (
    <View testID={testID} onTouchStart={autoPlay ? stopAutoPlay : undefined}>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ marginHorizontal: -edgeInset }}>
        <Animated.ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={onScroll}
          onScrollBeginDrag={stopAutoPlay}
          style={WEB_SNAP_SCROLLER}
          contentContainerStyle={{ paddingLeft: edgeInset, paddingRight: endPad, paddingTop, paddingBottom }}
        >
          {data.map((item, i) => {
            const info: SnapCarouselItemInfo = { index: i, depth: Math.abs(i - index), scrollX, step };
            return (
              <Animated.View
                key={keyExtractor(item)}
                style={[{ width: itemWidth, marginRight: after, zIndex: 20 - info.depth }, itemStyle?.(info), WEB_SNAP_ITEM]}
              >
                {renderItem(item, info)}
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </View>

      <View testID={dotsTestID} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: spacing.xs }}>
        {showArrows ? (
          <IconButton
            icon="chevron-left"
            variant="tonal"
            size="sm"
            accessibilityLabel={prevLabel}
            disabled={index <= 0}
            onPress={() => goTo(index - 1)}
            testID={prevTestID}
            style={{ marginRight: spacing.xs }}
          />
        ) : null}
        {data.map((item, i) => (
          <Dot key={keyExtractor(item)} active={i === index} color={activeColor} track={colors.borderStrong} label={dotLabel(item)} onPress={() => goTo(i)} />
        ))}
        {showArrows ? (
          <IconButton
            icon="chevron-right"
            variant="tonal"
            size="sm"
            accessibilityLabel={nextLabel}
            disabled={index >= last}
            onPress={() => goTo(index + 1)}
            testID={nextTestID}
            style={{ marginLeft: spacing.xs }}
          />
        ) : null}
      </View>
    </View>
  );
}
