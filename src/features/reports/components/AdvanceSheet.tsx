import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { listUserAdvances } from '@/api/salaryReports';
import { BottomSheet, Card, EmptyState, ErrorState, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { queryKeys } from '@/lib/query/queryKeys';
import { spacing } from '@/theme';
import type { Advance } from '@/types/api/salaryReports';

export interface AdvanceTarget {
  userId: string;
  name: string;
}

/** Newest first. */
export function sortAdvances(list: readonly Advance[]): Advance[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date));
}

function rawText(advance: Advance, key: string): string {
  const v = advance.raw[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
}

/** Advance records of one employee (all months, newest first), with distinct loading / error / empty states. */
export function AdvanceSheet({ target, orgId, onClose }: { target: AdvanceTarget | null; orgId: string; onClose: () => void }) {
  const userId = target?.userId ?? '';
  const query = useQuery({
    queryKey: queryKeys.salaryReports.advances(orgId, { userId }),
    enabled: !!target && orgId !== '',
    queryFn: async () => sortAdvances(await listUserAdvances(userId, orgId)),
  });
  return (
    <BottomSheet visible={target !== null} onClose={onClose} title="Advance Details" snap="half" size="md">
      <View style={{ gap: spacing.md }}>
        {target ? (
          <Text variant="callout" color="textSecondary">
            {target.name}
          </Text>
        ) : null}
        {query.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="callout" color="textSecondary" align="center">
              Loading advance records...
            </Text>
            <SkeletonList count={3} variant="line" />
          </View>
        ) : query.isError ? (
          <ErrorState compact message={getErrorMessage(query.error, 'Failed to load advances')} onRetry={() => void query.refetch()} />
        ) : (query.data ?? []).length === 0 ? (
          <EmptyState compact icon="wallet" title="No advance records found." />
        ) : (
          (query.data ?? []).map((a, i) => {
            const advanceId = rawText(a, 'advance_id');
            return (
              <Card key={a.id || i} variant="outlined" padding={spacing.md} testID={`advance-${a.id || i}`}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="title3" color="warning">
                    {formatINR(a.amount, { decimals: 2 })}
                  </Text>
                  <Text variant="callout" color="textSecondary">
                    {formatDate(a.date)}
                  </Text>
                </View>
                <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
                  {`Added by: ${rawText(a, 'created_by_name') || '—'}`}
                </Text>
                {advanceId ? (
                  <Text variant="caption" color="textMuted">
                    {`ID: ${advanceId}`}
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
