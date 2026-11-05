import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Calendar, Modal } from '@/components/ui';
import { currentMonthIST, parseDateParts, todayIST } from '@/lib/datetime';
import { spacing } from '@/theme';

function monthOf(value: string | null): { month: number; year: number } {
  const p = parseDateParts(value ?? '');
  return p ? { month: p.month, year: p.year } : currentMonthIST();
}

export interface DatePickerModalProps {
  visible: boolean;
  /** Selected `YYYY-MM-DD` (or '' / null). */
  value: string | null;
  title?: string;
  onSelect: (date: string) => void;
  /** Adds a "Clear" button (empties the value). */
  onClear?: () => void;
  /** Adds a "Today" button. */
  showToday?: boolean;
  onClose: () => void;
  minDate?: string;
  maxDate?: string;
}

/**
 * The one calendar dialog of the CRM screens (v1 had four copy-pasted calendars). Picking a day selects it and closes
 * the dialog; opening it shows the month of the current value (or the current IST month). Each caller owns its own
 * picker state, so the staff "forward date" and "required date" pickers can no longer write into each other.
 */
export function DatePickerModal({ visible, value, title = 'Pick a date', onSelect, onClear, showToday, onClose, minDate, maxDate }: DatePickerModalProps) {
  const [view, setView] = useState(() => monthOf(value));
  const [wasVisible, setWasVisible] = useState(visible);
  // Opening shows the month of the current value (state adjusted during render, not in an effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setView(monthOf(value));
  }

  const pick = (date: string) => {
    onSelect(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onClear ? (
            <Button
              title="Clear"
              variant="ghost"
              size="sm"
              onPress={() => {
                onClear();
                onClose();
              }}
            />
          ) : null}
          {showToday ? <Button title="Today" variant="secondary" size="sm" onPress={() => pick(todayIST())} /> : null}
          <Button title="Cancel" variant="secondary" size="sm" onPress={onClose} />
        </View>
      }
    >
      <Calendar
        month={view.month}
        year={view.year}
        onMonthChange={setView}
        selectedDates={value ? [value] : []}
        onDayPress={pick}
        minDate={minDate}
        maxDate={maxDate}
      />
    </Modal>
  );
}
