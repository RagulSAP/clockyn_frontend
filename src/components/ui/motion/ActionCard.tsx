import React from 'react';
import { Pressable, View } from 'react-native';

import { elevation, radii, spacing, useTheme } from '@/theme';

import { CountBadge } from '../Badge';
import { GradientView } from '../GradientView';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';

/** `#RRGGBB` + alpha -> `rgba(...)`; anything else is returned unchanged. */
function tint(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const ACTION_CARD_HEIGHT = 172;

export type ActionCardProps = {
  icon: IconName;
  title: string;
  blurb?: string;
  /** Meaning colour of the soft glow behind the card (use a status / semantic colour, not decoration). */
  accent: string;
  /** Pending count shown top-right. */
  badge?: number;
  /** Plan-gated: shows a lock hint (the tap should still explain why). */
  locked?: boolean;
  onPress: () => void;
  testID?: string;
  /** Test id of the badge when it must differ from `<testID>-badge`. */
  badgeTestID?: string;
  height?: number;
  /**
   * Header-strip layout for stacked cards: one row (icon, title, blurb, badge, arrow) pinned to the top. Give it a height
   * of strip + the overlap the next card covers, so the visible strip holds the whole row.
   */
  compact?: boolean;
};

/** CRED-style hero card: graphite gradient, glow, icon tile top-left, title + blurb bottom-left, round arrow bottom-right. */
export function ActionCard({ icon, title, blurb, accent, badge, locked, onPress, testID, badgeTestID, height = ACTION_CARD_HEIGHT, compact }: ActionCardProps) {
  const { colors } = useTheme();
  const ink = colors.onGradient;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={locked ? `${title}, upgrade required` : title}
      // the hint carries what a sighted user reads on the card: the blurb and the pending count
      accessibilityHint={[blurb, badge && badge > 0 ? `${badge} pending` : ''].filter(Boolean).join('. ') || undefined}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        { height, borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', opacity: pressed ? 0.92 : 1 },
        elevation.lg(colors.shadow),
      ]}
    >
      <GradientView style={compact ? { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 14 } : { flex: 1, padding: spacing.lg + 6, justifyContent: 'space-between' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -46, right: -34, width: 150, height: 150, borderRadius: 75, backgroundColor: tint(accent, 0.15) }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: -10, right: 6, width: 70, height: 70, borderRadius: 35, backgroundColor: tint(accent, 0.1) }} />

        {compact ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 44 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.md,
                backgroundColor: 'rgba(255,255,255,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={22} color={ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="title3" color="onGradient" numberOfLines={1}>
                {title}
              </Text>
              {blurb ? (
                <Text variant="caption" color="onGradient" style={{ opacity: 0.72 }} numberOfLines={1}>
                  {blurb}
                </Text>
              ) : null}
            </View>
            {badge && badge > 0 ? <CountBadge count={badge} testID={badgeTestID ?? (testID ? `${testID}-badge` : undefined)} /> : null}
            {locked ? <Icon name="lock" size={16} color={ink} /> : null}
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="arrow-right" size={16} color={colors.gradientEnd} />
            </View>
          </View>
        ) : (
          <>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radii.md,
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={22} color={ink} />
          </View>
          {badge && badge > 0 ? <CountBadge count={badge} testID={badgeTestID ?? (testID ? `${testID}-badge` : undefined)} /> : null}
          {locked ? <Icon name="lock" size={16} color={ink} /> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="title2" color="onGradient" numberOfLines={1}>
              {title}
            </Text>
            {blurb ? (
              <Text variant="caption" color="onGradient" style={{ opacity: 0.72, marginTop: 2 }} numberOfLines={2}>
                {blurb}
              </Text>
            ) : null}
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-right" size={18} color={colors.gradientEnd} />
          </View>
        </View>
          </>
        )}
      </GradientView>
    </Pressable>
  );
}
