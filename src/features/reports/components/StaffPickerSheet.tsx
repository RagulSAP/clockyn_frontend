import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Avatar, BottomSheet, Icon, ListItem, SearchBar, Text } from '@/components/ui';
import { spacing } from '@/theme';
import type { ReportStaffOption } from '../types';
import { filterOptions } from '../hooks/useReportStaffOptions';

export type StaffSelection = 'all' | ReportStaffOption;

/** Bottom sheet / dialog to pick "All Staff" or one staff member (searchable by name or employee id). */
export function StaffPickerSheet({
  visible,
  onClose,
  options,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  options: readonly ReportStaffOption[];
  selected: StaffSelection;
  onSelect: (value: StaffSelection) => void;
}) {
  const [query, setQuery] = useState('');
  // The search box is cleared whenever the picker closes, so it always opens empty.
  const close = () => {
    setQuery('');
    onClose();
  };
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const check = <Icon name="check" size={20} color="primary" />;

  return (
    <BottomSheet visible={visible} onClose={close} title="Select Staff" snap="tall" size="md">
      <View style={{ gap: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name or ID..." />
        <ListItem
          icon="star"
          iconTone="primary"
          title="All Staff"
          subtitle="Generate reports for all staff"
          right={selected === 'all' ? check : undefined}
          onPress={() => {
            onSelect('all');
            close();
          }}
          testID="staff-all"
          divider
        />
        {filtered.length === 0 ? (
          <Text color="textMuted" align="center" style={{ paddingVertical: spacing.lg }}>
            No staff found
          </Text>
        ) : (
          filtered.map((o) => {
            const on = selected !== 'all' && selected.userId === o.userId;
            return (
              <ListItem
                key={o.userId}
                left={<Avatar name={o.name} size={40} />}
                title={o.name}
                subtitle={[o.empId, o.department, o.isActive ? '' : 'Inactive'].filter(Boolean).join('  •  ')}
                right={on ? check : undefined}
                onPress={() => {
                  onSelect(o);
                  close();
                }}
                testID={`staff-${o.userId}`}
                divider
              />
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
