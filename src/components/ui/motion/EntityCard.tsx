import React from 'react';
import { Pressable, View } from 'react-native';

import { radii, spacing, useTheme } from '@/theme';

import { Button } from '../Button';
import { Card } from '../Card';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { Text } from '../Text';

export type EntityCardProps = {
  icon: IconName;
  /** Small wide-tracked label above the number, e.g. Staff. */
  title: string;
  /** Live number; `null` while loading. */
  count: number | null;
  /** Unit next to the number, e.g. on roll or locations. */
  noun: string;
  /** Tapping the card body (opens the list). */
  onPress: () => void;
  viewLabel: string;
  viewTestID?: string;
  countTestID?: string;
  /** Primary action (creates one). Omit to render the card without the button. */
  onAdd?: () => void;
  addTitle?: string;
  addLabel?: string;
  addTestID?: string;
};

/** Card with a big live number: tap the body to open the list, the Add button on the right creates one. */
export function EntityCard({ icon, title, count, noun, onPress, viewLabel, viewTestID, countTestID, onAdd, addTitle = 'Add', addLabel, addTestID }: EntityCardProps) {
  const { colors } = useTheme();
  return (
    <Card padding={0}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: onAdd ? spacing.md : 0 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={viewLabel}
          onPress={onPress}
          testID={viewTestID}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, opacity: pressed ? 0.7 : 1 })}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              borderTopColor: colors.highlight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={22} color="text" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="micro" color="textMuted" style={{ textTransform: 'uppercase' }} numberOfLines={1}>
              {title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text variant="title1" testID={countTestID}>
                {count ?? '-'}
              </Text>
              <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {noun}
              </Text>
            </View>
          </View>
          <Icon name="chevron-right" size={18} color="textMuted" />
        </Pressable>
        {onAdd ? (
          <Button title={addTitle} icon="plus" size="sm" accessibilityLabel={addLabel ?? addTitle} testID={addTestID} onPress={onAdd} style={{ alignSelf: 'center' }} />
        ) : null}
      </View>
    </Card>
  );
}
