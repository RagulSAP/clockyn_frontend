import React from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, IconButton, Text, type IconName } from '@/components/ui';
import { formatRelativeTime } from '@/lib/datetime';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';
import type { Announcement } from '@/types/api/announcements';
import { tint, type AudienceTag } from '../targets';

export type AnnouncementCardProps = {
  announcement: Announcement;
  /** Audience pill (icon + text). */
  tag: AudienceTag;
  /** Left border / icon accent. Default: monochrome (primary); colour is reserved for meaning. */
  accent?: keyof ColorTokens;
  /** Leading icon tile (default: megaphone). */
  icon?: IconName;
  /** Admin history: show the delete button. */
  onDelete?: (a: Announcement) => void;
  /** Clamp the message (history: 4 lines). Omit to show the full text (feeds). */
  messageLines?: number;
  testID?: string;
};

/** One announcement (admin history entry or staff feed item). */
export function AnnouncementCard({ announcement: a, tag, accent, icon = 'megaphone', onDelete, messageLines, testID }: AnnouncementCardProps) {
  const { colors } = useTheme();
  const accentColor = colors[accent ?? 'primary'];

  return (
    <Card padding={0} testID={testID} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: accent ? accentColor : colors.borderStrong }} />
        <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radii.sm + 2,
                backgroundColor: tint(accentColor, 0.14),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={icon} size={20} color={accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={2}>
                {a.title}
              </Text>
              <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                {formatRelativeTime(a.createdAt)}
              </Text>
            </View>
            {onDelete ? (
              <IconButton
                icon="trash"
                variant="plain"
                accessibilityLabel={`Delete announcement ${a.title}`}
                onPress={() => onDelete(a)}
                testID={testID ? `${testID}-delete` : undefined}
              />
            ) : null}
          </View>
          <Text variant="body" color="textSecondary" numberOfLines={messageLines}>
            {a.message}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }}>
            <Badge label={tag.label} icon={tag.icon} tone="primary" size="sm" />
            {a.sentBy ? (
              <Text variant="caption" color="textMuted">
                {`by ${a.sentBy}`}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}
