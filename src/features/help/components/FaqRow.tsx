import React, { memo, useCallback, useSyncExternalStore } from 'react';
import { LayoutAnimation, Platform, Pressable, View } from 'react-native';

import { Icon, Text, type TextProps } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import type { SupportFaq } from '@/types/api/support';

import type { FaqOpenStore } from '../utils/faqOpen';
import { splitMatches } from '../utils/faq';

/** Text with the searched words in bold; plain text (a single string child) when nothing is searched. */
export function HighlightedText({
  children,
  words,
  ...rest
}: Omit<TextProps, 'children'> & {
  children: string;
  words: readonly string[];
}) {
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
  /** Which rows are open (see `createFaqOpenStore`): the row subscribes to its own entry only. */
  store: FaqOpenStore;
  /** Searched words: shown in bold in the question and, once open, in the answer. Keep the array stable between renders. */
  highlight?: readonly string[];
  /** Small chip under the question, e.g. "Attendance & Time > Shifts" (search results). */
  chip?: string;
};

const NO_WORDS: readonly string[] = [];

// Web: the browser skips layout and paint of rows that are far off screen (a long list stays cheap); a collapsed row is ~56px tall.
const OFFSCREEN_SKIP = (Platform.OS === 'web' ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 56px' } : undefined) as object | undefined;

/**
 * One FAQ: a row that shows ONLY the question and a chevron. Pressing anywhere on the row opens the answer in place under it and
 * pressing again closes it; rows toggle independently of each other. The answer is only mounted while the row is open, so a
 * collapsed answer is neither on screen nor read out by assistive technology.
 *
 * Cheap on purpose (the list can hold hundreds of rows): memoized, the open state is read from the store so only THIS row renders
 * when it is toggled, and the open/close animation is the native LayoutAnimation (it runs off the JS thread, nothing is measured
 * or animated frame by frame in JavaScript).
 */
export const FaqRow = memo(function FaqRow({ faq, store, highlight = NO_WORDS, chip }: FaqRowProps) {
  const { colors } = useTheme();
  const { id } = faq;
  const expanded = useSyncExternalStore(
    useCallback((notify: () => void) => store.subscribe(id, notify), [store, id]),
    () => store.isOpen(id),
    () => false,
  );

  const onPress = useCallback(() => {
    if (store.animate && Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    store.toggle(id);
  }, [store, id]);

  return (
    <View testID={`faq-item-${id}`} style={OFFSCREEN_SKIP}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        testID={`faq-${id}`}
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
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: colors.primarySoft,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text variant="micro" color="textSecondary" testID={`faq-${id}-chip`}>
                {chip}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Icon name="chevron-down" size={20} color="textMuted" />
        </View>
      </Pressable>

      {expanded ? (
        <View testID={`faq-${id}-panel`} style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: radii.md,
              padding: spacing.md,
            }}
          >
            <HighlightedText variant="body" color="textSecondary" selectable testID={`faq-${id}-answer`} words={highlight}>
              {faq.answer}
            </HighlightedText>
          </View>
        </View>
      ) : null}
    </View>
  );
});
