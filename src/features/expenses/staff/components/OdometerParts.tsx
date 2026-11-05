import React from 'react';
import { View } from 'react-native';

import { Badge, Card, EmptyState, ErrorState, Icon, SkeletonList, Text } from '@/components/ui';
import { formatNumber } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';
import type { OdometerReading } from '@/types/api/expenses';

import type { OdometerMode } from '../utils/expenseRules';

const DASH = '—';
const km = (n: number | undefined): string => (n === undefined ? DASH : formatNumber(n));

export type ReadingsCardProps = {
  title: string;
  readings: readonly OdometerReading[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
};

/** Readings of the selected day: Start KM / Stop KM / Distance. */
export function ReadingsCard({ title, readings, loading, failed, onRetry }: ReadingsCardProps) {
  const { colors } = useTheme();
  const body = loading ? (
    <SkeletonList count={2} />
  ) : failed && readings.length === 0 ? (
    <ErrorState compact message="Could not load the readings." onRetry={onRetry} />
  ) : readings.length === 0 ? (
    <EmptyState compact icon="route" title="No readings yet" message="Submit your start reading below to begin tracking" />
  ) : (
    <View testID="odometer-table">
      <View style={{ flexDirection: 'row', paddingBottom: spacing.sm }}>
        {['Start KM', 'Stop KM', 'Distance'].map((h, i) => (
          <Text key={h} variant="micro" color="textMuted" align={i === 2 ? 'right' : 'left'} style={{ flex: 1 }}>
            {h.toUpperCase()}
          </Text>
        ))}
      </View>
      {readings.map((r, i) => (
        <View
          key={r.id || `${r.date}-${i}`}
          testID={`reading-${i}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.sm,
            marginHorizontal: -spacing.sm,
            borderRadius: radii.sm,
            backgroundColor: i % 2 === 1 ? colors.surfaceMuted : 'transparent',
          }}
        >
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {km(r.startKm)}
          </Text>
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {km(r.stopKm)}
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {r.distanceKm ? <Badge tone="success" label={`${formatNumber(r.distanceKm)} km`} /> : <Text color="textMuted">{DASH}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="title3">{title}</Text>
      {body}
    </Card>
  );
}

/** Two-step indicator: Start -> Stop. In stop mode step 1 is done and step 2 active. */
export function StepIndicator({ mode }: { mode: OdometerMode }) {
  const { colors } = useTheme();
  const done = mode === 'stop';
  const circle = (active: boolean, complete: boolean, label: string) => (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: complete ? colors.success : active ? colors.primary : colors.surfaceMuted,
      }}
    >
      {complete ? (
        <Icon name="check" size={18} color="onPrimary" />
      ) : (
        <Text variant="bodyStrong" color={active ? 'onPrimary' : 'textMuted'}>
          {label}
        </Text>
      )}
    </View>
  );
  return (
    <View testID="odometer-steps" accessibilityLabel={done ? 'Step 2 of 2: Stop reading' : 'Step 1 of 2: Start reading'} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        {circle(!done, done, '1')}
        <Text variant="caption" color={done ? 'success' : 'primary'} weight="semibold">
          Start
        </Text>
      </View>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted, marginBottom: spacing.lg, overflow: 'hidden' }}>
        <View style={{ width: done ? '100%' : '0%', height: 4, backgroundColor: colors.success }} />
      </View>
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        {circle(done, false, '2')}
        <Text variant="caption" color={done ? 'primary' : 'textMuted'} weight="semibold">
          Stop
        </Text>
      </View>
    </View>
  );
}
