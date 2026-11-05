import React, { useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { PickerTrigger } from './internal/PickerTrigger';
import { dateFromStr, formatDisplayDate, localTodayStr, strFromDate } from './internal/dates';

export type DateFieldProps = {
  label?: string;
  /** `YYYY-MM-DD`, or empty string when unset. */
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  placeholder?: string;
  error?: string | boolean | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function clampToRange(d: Date, min: Date | null, max: Date | null): Date {
  if (min && d < min) return min;
  if (max && d > max) return max;
  return d;
}

/** Native date field: system dialog on Android, inline calendar in a sheet on iOS. (Web: DateField.web.tsx) */
export function DateField({ label, value, onChange, minDate, maxDate, placeholder = 'Select date', error, hint, required, disabled, style, testID }: DateFieldProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const min = dateFromStr(minDate);
  const max = dateFromStr(maxDate);
  const current = clampToRange(dateFromStr(value) ?? dateFromStr(localTodayStr()) ?? new Date(), min, max);
  const [draft, setDraft] = useState<Date>(current);

  const openPicker = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        minimumDate: min ?? undefined,
        maximumDate: max ?? undefined,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(strFromDate(d));
        },
      });
      return;
    }
    setDraft(current);
    setOpen(true);
  };

  return (
    <>
      <PickerTrigger
        label={label}
        required={required}
        error={error}
        hint={hint}
        disabled={disabled}
        text={formatDisplayDate(value)}
        placeholder={placeholder}
        leftIcon="calendar"
        rightIcon="chevron-down"
        open={open}
        style={style}
        testID={testID}
        onPress={openPicker}
      />
      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label ?? 'Select date'}
          footer={
            <Button
              title="Done"
              fullWidth
              onPress={() => {
                onChange(strFromDate(draft));
                setOpen(false);
              }}
            />
          }
        >
          <View style={{ alignItems: 'center' }}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="inline"
              minimumDate={min ?? undefined}
              maximumDate={max ?? undefined}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={colors.primary}
              onChange={(_e: DateTimePickerEvent, d?: Date) => {
                if (d) setDraft(d);
              }}
            />
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}
