import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { Avatar, Badge, Text } from '@/components/ui';
import { useBreakpoint } from '@/components/layout';

/** Width of the frozen Employee column: narrower on phones so the scrolling columns keep more than a sliver of the screen. */
export function useEmployeeColumnWidth(wide = 210): number {
  const { isPhone } = useBreakpoint();
  return isPhone ? 168 : wide;
}

/** Frozen first-column cell: avatar, name and up to two sub-lines. */
export function EmployeeCell({
  name,
  line2,
  line3,
  photoUrl,
  badge,
}: {
  name: string;
  line2?: string;
  line3?: string;
  photoUrl?: string | null;
  badge?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
      <Avatar uri={photoUrl} name={name} size={36} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>
          {name}
        </Text>
        {line2 ? (
          <Text variant="caption" color="primary" numberOfLines={1}>
            {line2}
          </Text>
        ) : null}
        {line3 ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {line3}
          </Text>
        ) : null}
      </View>
      {badge ? <Badge label={badge} tone="primary" size="sm" /> : null}
    </View>
  );
}
