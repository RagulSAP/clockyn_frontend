import React from 'react';
import { View } from 'react-native';

import { Card, Reveal, SectionHeader, Tabs } from '@/components/ui';
import { useBreakpoint } from '@/components/layout';
import { spacing } from '@/theme';

export type AnnouncementTab = 'compose' | 'history';

export type ComposeHistoryLayoutProps = {
  tab: AnnouncementTab;
  onTabChange: (tab: AnnouncementTab) => void;
  /** Number shown on the History tab (0 hides it). */
  historyCount: number;
  compose: React.ReactNode;
  history: React.ReactNode;
};

/** Phones / tablets: Compose | History tabs. Desktop (>= 1100): compose and history side by side. */
export function ComposeHistoryLayout({ tab, onTabChange, historyCount, compose, history }: ComposeHistoryLayoutProps) {
  const { isDesktop } = useBreakpoint();

  if (isDesktop) {
    return (
      <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.lg }}>
          <SectionHeader title="Compose" />
          <Reveal index={0}>
            <Card>{compose}</Card>
          </Reveal>
        </View>
        <View style={{ flex: 1, gap: spacing.lg }}>
          <SectionHeader title={historyCount > 0 ? `History (${historyCount})` : 'History'} />
          <Reveal index={1}>{history}</Reveal>
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Reveal index={0}>
      <Tabs
        tabs={[
          { key: 'compose', label: 'Compose' },
          { key: 'history', label: 'History', badge: historyCount > 0 ? historyCount : undefined },
        ]}
        active={tab}
        onChange={(k) => onTabChange(k === 'history' ? 'history' : 'compose')}
        testID="announcement-tabs"
      />
      </Reveal>
      <Reveal index={1}>{tab === 'compose' ? <Card>{compose}</Card> : history}</Reveal>
    </View>
  );
}
