import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { Icon, Text, type TextProps } from '@/components/ui';
import { useReduceMotion } from '@/components/ui/motion';
import { radii, spacing, useTheme } from '@/theme';
import type { SupportFaq } from '@/types/api/support';

import { splitMatches } from '../utils/faq';

const DURATION_MS = 220;

/** Text with the searched words in bold; plain text (a single string child) when nothing is searched. */
export function HighlightedText({ children, words, ...rest }: Omit<TextProps, 'children'> & { children: string; words: readonly string[] }) {
  if (words.length === 0) return <Text {...rest}>{children}</Text>;
  return (
    <Text {...rest}>
      {splitMatches(children, words).map((part, i) =>
        part.match ? (
          <Text key={i} variant={rest.variant} color={rest.color} weight="bold" testID="faq-match">
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}

export type FaqRowProps = {
  faq: SupportFaq;
  expanded: boolean;
  onToggle: () => void;
  /** Searched words: shown in bold in the question and, once open, in the answer. */
  highlight?: readonly string[];
  /** Small chip under the question, e.g. "Attendance & Time > Shifts" (search results). */
  chip?: string;
};

const NO_WORDS: readonly string[] = [];

/**
 * One FAQ: a row that shows ONLY the question and a chevron. Pressing anywhere on the row opens the answer in place under it
 * (height + opacity animation) and pressing again closes it; rows toggle independently of each other. The answer is only
 * mounted while it is open or animating, so a collapsed answer is neither on screen nor read out by assistive technology.
 */
export function FaqRow({ faq, expanded, onToggle, highlight = NO_WORDS, chip }: FaqRowProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(expanded ? 1 : 0));
  const [contentHeight, setContentHeight] = useState(0);
  // `moving` is true from the moment `expanded` flips until the animation has finished (set while rendering, not in an effect)
  const [seen, setSeen] = useState(expanded);
  const [moving, setMoving] = useState(false);
  if (seen !== expanded) {
    setSeen(expanded);
    setMoving(true);
  }

  useEffect(() => {
    if (!moving) return undefined;
    const anim = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: reduceMotion ? 0 : DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // height cannot run on the native driver; one JS-driven value also drives the chevron
    });
    anim.start(({ finished }) => {
      if (finished) setMoving(false);
    });
    return () => anim.stop();
  }, [expanded, moving, reduceMotion, progress]);

  const mounted = expanded || moving; // a collapsed answer is not mounted at all: not on screen, not read out

  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(contentHeight, 0)] });
  // while animating the content is measured out of flow so the fixed height never squeezes it; once settled it flows normally
  const settledOpen = expanded && !moving;

  return (
    <View testID={`faq-item-${faq.id}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        testID={`faq-${faq.id}`}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed || hovered ? colors.surfaceMuted : 'transparent',
        })}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <HighlightedText variant="bodyStrong" weight="medium" words={highlight}>
            {faq.question}
          </HighlightedText>
          {chip ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
              <Text variant="micro" color="textSecondary" testID={`faq-${faq.id}-chip`}>
                {chip}
              </Text>
            </View>
          ) : null}
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon name="chevron-down" size={20} color="textMuted" />
        </Animated.View>
      </Pressable>

      {mounted ? (
        <Animated.View
          testID={`faq-${faq.id}-panel`}
          style={settledOpen ? undefined : { height, opacity: progress, overflow: 'hidden' }}
        >
          <View
            onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
            style={settledOpen ? undefined : { position: 'absolute', left: 0, right: 0, top: 0 }}
          >
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
              <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md }}>
                <HighlightedText variant="body" color="textSecondary" selectable testID={`faq-${faq.id}-answer`} words={highlight}>
                  {faq.answer}
                </HighlightedText>
              </View>
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
