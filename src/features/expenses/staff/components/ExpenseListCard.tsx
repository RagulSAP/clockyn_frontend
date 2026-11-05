import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Badge, Card, EmptyState, ErrorState, Icon, ImageViewer, SkeletonList, Text, type IconName } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';
import type { Expense } from '@/types/api/expenses';

import { roundedTotal } from '../utils/expenseRules';

export type ExpenseListCardProps = {
  title: string;
  /** Column header, e.g. "Ticket" / "Bill". */
  columnLabel: string;
  emptyTitle: string;
  emptyMessage: string;
  placeholderIcon: IconName;
  expenses: readonly Expense[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
};

/** Submitted tickets / bills of the selected date with a rounded total. */
export function ExpenseListCard({ title, columnLabel, emptyTitle, emptyMessage, placeholderIcon, expenses, loading, failed, onRetry }: ExpenseListCardProps) {
  const { colors } = useTheme();
  const [viewing, setViewing] = useState<string | null>(null);

  const body = loading ? (
    <SkeletonList count={2} />
  ) : failed && expenses.length === 0 ? (
    <ErrorState compact message="Could not load the list." onRetry={onRetry} />
  ) : expenses.length === 0 ? (
    <EmptyState compact icon={placeholderIcon} title={emptyTitle} message={emptyMessage} />
  ) : (
    <View testID="expense-rows">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.sm }}>
        <Text variant="micro" color="textMuted">
          {columnLabel.toUpperCase()}
        </Text>
        <Text variant="micro" color="textMuted">
          AMOUNT
        </Text>
      </View>
      {expenses.map((e, i) => (
        <View
          key={e.id || `${e.date}-${i}`}
          testID={`expense-row-${i}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            marginHorizontal: -spacing.sm,
            borderRadius: radii.sm,
            backgroundColor: i % 2 === 1 ? colors.surfaceMuted : 'transparent',
          }}
        >
          {e.photoUrl ? (
            <Pressable onPress={() => setViewing(e.photoUrl ?? null)} accessibilityRole="imagebutton" accessibilityLabel={`View ${columnLabel.toLowerCase()} photo`}>
              <Image source={{ uri: e.photoUrl }} resizeMode="cover" style={{ width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted }} />
            </Pressable>
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={placeholderIcon} size={22} color="textMuted" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            {e.createdAt ? (
              <Text variant="caption" color="textMuted">
                {formatDate(e.createdAt)}
              </Text>
            ) : null}
          </View>
          <Text variant="bodyStrong">{formatINR(e.amount)}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="title3">{title}</Text>
        {expenses.length > 0 ? <Badge tone="primary" label={`Total ${formatINR(roundedTotal(expenses))}`} testID="expense-total" /> : null}
      </View>
      {body}
      <ImageViewer visible={viewing !== null} uri={viewing} onClose={() => setViewing(null)} caption={`${columnLabel} photo`} />
    </Card>
  );
}
