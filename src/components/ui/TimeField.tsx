import React, { useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { PickerTrigger } from './internal/PickerTrigger';
import { formatDisplayTime, pad2, parseTimeStr } from './internal/dates';

export type TimeFieldProps = {
  label?: string;
  /** `HH:mm` (24h), or empty string when unset. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | boolean | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function dateFromTime(value: string): Date {
  const p = parseTimeStr(value) ?? { hours: 9, minutes: 0 };
  const d = new Date();
  d.setHours(p.hours, p.minutes, 0, 0);
  return d;
}
const timeFromDate = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Native time field: system dialog on Android, wheel picker in a sheet on iOS. (Web: TimeField.web.tsx) */
export function TimeField({ label, value, onChange, placeholder = 'Select time', error, hint, required, disabled, style, testID }: TimeFieldProps) {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => dateFromTime(value));

  const openPicker = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: dateFromTime(value),
        mode: 'time',
        is24Hour: false,
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(timeFromDate(d));
        },
      });
      return;
    }
    setDraft(dateFromTime(value));
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
        text={formatDisplayTime(value)}
        placeholder={placeholder}
        leftIcon="clock"
        open={open}
        style={style}
        testID={testID}
        onPress={openPicker}
      />
      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={label ?? 'Select time'}
          footer={
            <Button
              title="Done"
              fullWidth
              onPress={() => {
                onChange(timeFromDate(draft));
                setOpen(false);
              }}
            />
          }
        >
          <View style={{ alignItems: 'center' }}>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={colors.primary}
              textColor={colors.text}
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
