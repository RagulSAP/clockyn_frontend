import React from 'react';
import { View } from 'react-native';

import { FilterChips, IconButton, type ChipOption } from '@/components/ui';
import { spacing } from '@/theme';

import type { CfrDateFilterKey } from '../types';
import { customChipLabel } from '../utils/dates';

export interface DateChipBarProps {
  value: CfrDateFilterKey;
  /** `YYYY-MM-DD` picked through the calendar (used when `value === 'custom'`). */
  customDate: string;
  /** Adds the leading "All" chip (carry-forward requests). */
  includeAll?: boolean;
  /** Chip pressed (Yesterday / Today / Tomorrow / All). */
  onChange: (value: Exclude<CfrDateFilterKey, 'custom'>) => void;
  /** "Pick Date" pressed - the parent opens the calendar. */
  onPickDate: () => void;
  /** The x next to an active custom date. */
  onClearCustom: () => void;
  testID?: string;
}

/** Yesterday / Today / Tomorrow / Pick Date chips (`dd/MM` + clear x once a custom date is chosen). */
export function DateChipBar({ value, customDate, includeAll, onChange, onPickDate, onClearCustom, testID }: DateChipBarProps) {
  const options: ChipOption<CfrDateFilterKey>[] = [
    ...(includeAll ? [{ label: 'All', value: 'all' as const }] : []),
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Today', value: 'today' },
    { label: 'Tomorrow', value: 'tomorrow' },
    { label: value === 'custom' && customDate ? customChipLabel(customDate) : 'Pick Date', value: 'custom', icon: 'calendar' },
  ];
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ flexShrink: 1 }}>
        <FilterChips<CfrDateFilterKey>
          options={options}
          value={value}
          onChange={(v) => (v === 'custom' ? onPickDate() : onChange(v))}
        />
      </View>
      {value === 'custom' && customDate ? <IconButton icon="x" variant="plain" size="sm" accessibilityLabel="Clear picked date" onPress={onClearCustom} /> : null}
    </View>
  );
}
