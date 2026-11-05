import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, IconButton, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

export interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  photoUrl?: string | null;
  /** Phone: back to the list. Hidden in the desktop split view. */
  onBack?: () => void;
  /** Tapping the title block (group: members, direct: contact info). */
  onPressTitle?: () => void;
  right?: React.ReactNode;
}

/** Conversation header: back, avatar, name / sub-line and trailing actions. */
export function ChatHeader({ title, subtitle, photoUrl, onBack, onPressTitle, right }: ChatHeaderProps) {
  const { colors } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, minWidth: 0 }}>
      <Avatar uri={photoUrl} name={title} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title3" numberOfLines={1}>
          {title || 'Chat'}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 60,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {onBack ? <IconButton icon="arrow-left" variant="tonal" accessibilityLabel="Back to conversations" onPress={onBack} /> : null}
      {onPressTitle ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${title} details`} onPress={onPressTitle} style={{ flex: 1, minWidth: 0 }}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      {right}
    </View>
  );
}
