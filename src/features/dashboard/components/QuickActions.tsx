import React from 'react';
import { View } from 'react-native';

import { ActionCard, SectionHeader, type ActionCardProps } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/** Visible height of a card header in the stack. */
const STRIP = 72;
/** How far the next card covers the one above it (also the extra height of a covered card). */
const COVER = 24;
const LAST_CARD_HEIGHT = 148;

type Card = Omit<ActionCardProps, 'height' | 'compact'> & { key: string };

export type QuickActionsProps = {
  pendingRequests: number;
  staffLocationLocked: boolean;
  onStaffLocation: () => void;
  onReports: () => void;
  onRequests: () => void;
};

/**
 * Staff Location (plan-gated), View Reports, Requests (with pending-count badge) as three cards stacked one on top of
 * another, so all of them fit on one screen: the first two show their header strip, the last one is shown in full.
 */
export function QuickActions({ pendingRequests, staffLocationLocked, onStaffLocation, onReports, onRequests }: QuickActionsProps) {
  const { colors } = useTheme();

  const cards: Card[] = [
    { key: 'location', testID: 'qa-location', icon: 'map-pin', title: 'Staff Location', blurb: 'See where your team is right now', accent: colors.info, locked: staffLocationLocked, onPress: onStaffLocation },
    { key: 'reports', testID: 'qa-reports', icon: 'bar-chart', title: 'View Reports', blurb: 'Attendance, salary and more', accent: colors.warning, onPress: onReports },
    { key: 'requests', testID: 'qa-requests', icon: 'clipboard-list', title: 'Requests', blurb: 'Review leave and change requests', accent: colors.statusHoliday, badge: pendingRequests, onPress: onRequests },
  ];
  const last = cards.length - 1;

  return (
    <View testID="quick-actions">
      <SectionHeader title="Quick Actions" style={{ marginBottom: spacing.md }} />
      <View>
        {cards.map(({ key, ...card }, i) => (
          // later cards sit on top of earlier ones; the covered part of a card is just its rounded lower edge
          <View key={key} style={{ marginTop: i === 0 ? 0 : -COVER }}>
            <ActionCard {...card} compact={i !== last} height={i === last ? LAST_CARD_HEIGHT : STRIP + COVER} />
          </View>
        ))}
      </View>
    </View>
  );
}
