import React from 'react';
import { View } from 'react-native';

import { EntityCard, Reveal, SectionHeader, type IconName } from '@/components/ui';
import { spacing } from '@/theme';

export type ManageEntity = {
  /** `staff` | `branch` | `dept`: test ids are `manage-view-<key>` and `manage-add-<key>`. */
  key: string;
  icon: IconName;
  title: string;
  /** Unit shown next to the count ("on roll", "locations"). */
  noun: string;
  /** Live number; `null` while it is still loading. */
  count: number | null;
  viewLabel: string;
  addLabel: string;
  onView: () => void;
  onAdd: () => void;
};

/** First step of the page entrance sequence used by the Manage cards (filters, summary and quick actions come before). */
const FIRST_REVEAL_INDEX = 3;

/** Manage: one card per entity (Staff, Branches, Departments). The card opens the list, the Add button creates one. */
export function ManageCards({ items }: { items: ManageEntity[] }) {
  return (
    <View testID="manage-grid">
      <SectionHeader title="Manage" style={{ marginBottom: spacing.md }} />
      <View style={{ gap: spacing.md }}>
        {items.map((item, i) => (
          <Reveal key={item.key} index={FIRST_REVEAL_INDEX + i}>
            <EntityCard
              icon={item.icon}
              title={item.title}
              count={item.count}
              noun={item.noun}
              onPress={item.onView}
              viewLabel={item.viewLabel}
              viewTestID={`manage-view-${item.key}`}
              countTestID={`manage-count-${item.key}`}
              onAdd={item.onAdd}
              addLabel={item.addLabel}
              addTestID={`manage-add-${item.key}`}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
}
