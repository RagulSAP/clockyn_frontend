import React from 'react';
import { View } from 'react-native';

import { ActionCard, type ActionCardProps } from '@/components/ui';

/** Visible height of a card header in the stack. */
const STRIP = 72;
/** How far the next card covers the one above it (also the extra height of a covered card). */
const COVER = 24;
const LAST_CARD_HEIGHT = 148;

export type HubStackItem = Omit<ActionCardProps, 'height' | 'compact' | 'blurb'> & { key: string; description: string };

/** Request types as stacked graphite cards (same pattern as the admin Quick Actions): all but the last show their header strip. */
export function HubStack({ items }: { items: HubStackItem[] }) {
  const last = items.length - 1;
  return (
    <View>
      {items.map(({ key, description, ...card }, i) => (
        // later cards sit on top of earlier ones; the covered part of a card is just its rounded lower edge
        <View key={key} style={{ marginTop: i === 0 ? 0 : -COVER }}>
          <ActionCard {...card} blurb={description} compact={i !== last} height={i === last ? LAST_CARD_HEIGHT : STRIP + COVER} />
        </View>
      ))}
    </View>
  );
}
