import React from 'react';
import { View } from 'react-native';

import { ResponsiveRow, Screen } from '@/components/layout';
import { DateField, EmptyState, ErrorState, IconButton, LoadingOverlay, SkeletonList, Text, type IconName } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { todayIST } from '@/lib/datetime';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { recordsLabel } from '../utils/recordFilter';

type Props = {
  title: string;
  /** Rate card etc., rendered above the filter. */
  header?: React.ReactNode;
  date: string;
  onDateChange: (date: string) => void;
  shown: number;
  total: number;
  loading: boolean;
  error: unknown;
  hasError: boolean;
  hasData: boolean;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  busy: boolean;
  empty: { icon: IconName; title: string; message: string };
  testID: string;
  children?: React.ReactNode;
  modals?: React.ReactNode;
};

/** Shared page of the three expense review screens: date filter, record counter, states and a responsive card grid. */
export function ReviewFrame(p: Props) {
  const session = useSession();
  let body: React.ReactNode;
  if (p.loading) body = <SkeletonList count={4} />;
  else if (p.hasError && !p.hasData) body = <ErrorState message={getErrorMessage(p.error, 'Failed to load data')} onRetry={p.onRetry} />;
  else if (p.shown === 0) body = <EmptyState icon={p.empty.icon} title={p.empty.title} message={p.empty.message} />;
  else body = <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>{p.children}</ResponsiveRow>;

  return (
    <Screen
      title={p.title}
      subtitle={session?.orgName || undefined}
      refreshing={p.refreshing}
      onRefresh={p.onRefresh}
      testID={p.testID}
      overlay={<LoadingOverlay visible={p.busy} message="Processing..." />}
    >
      <View style={{ gap: spacing.lg }}>
        {p.header}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <DateField
              label="Filter by date"
              value={p.date}
              onChange={p.onDateChange}
              maxDate={todayIST()}
              placeholder="Filter by date"
              testID={`${p.testID}-date`}
            />
          </View>
          {p.date ? <IconButton icon="x" variant="tonal" accessibilityLabel="Clear date filter" onPress={() => p.onDateChange('')} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title3">Submissions</Text>
          <Text variant="caption" color="textMuted" testID={`${p.testID}-count`}>
            {recordsLabel(p.shown, p.total)}
          </Text>
        </View>
        {body}
      </View>
      {p.modals}
    </Screen>
  );
}
