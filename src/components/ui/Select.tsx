import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from './icons';
import { PickerSheet, type SelectOption } from './internal/PickerSheet';
import { PickerTrigger } from './internal/PickerTrigger';

export type { SelectOption } from './internal/PickerSheet';

export type SelectProps<T> = {
  label?: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  error?: string | boolean | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  /** Sheet title (defaults to the label). */
  title?: string;
  leftIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Single-choice picker. Opens a bottom sheet on phones and a centred dialog on wide screens / web. */
export function Select<T>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  searchable,
  error,
  hint,
  required,
  disabled,
  title,
  leftIcon,
  style,
  testID,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <PickerTrigger
        label={label}
        required={required}
        error={error}
        hint={hint}
        disabled={disabled}
        text={current?.label}
        placeholder={placeholder}
        leftIcon={leftIcon}
        open={open}
        style={style}
        testID={testID}
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title ?? label ?? placeholder}
        options={options}
        selected={value === null || value === undefined ? [] : [value]}
        searchable={searchable}
        onToggle={(v) => {
          onChange(v);
          setOpen(false);
        }}
      />
    </>
  );
}
