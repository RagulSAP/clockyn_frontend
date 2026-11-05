import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName } from './icons';
import { PickerSheet, type SelectOption } from './internal/PickerSheet';
import { PickerTrigger } from './internal/PickerTrigger';

export type MultiSelectProps<T> = {
  label?: string;
  values: T[];
  options: SelectOption<T>[];
  onChange: (values: T[]) => void;
  placeholder?: string;
  searchable?: boolean;
  /** Show a "Select all" row. */
  selectAll?: boolean;
  /** Trigger text when every option is selected (default: the chosen labels / "{n} selected"). */
  allSelectedText?: string;
  error?: string | boolean | null;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  title?: string;
  leftIcon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function MultiSelect<T>({
  label,
  values,
  options,
  onChange,
  placeholder = 'Select',
  searchable,
  selectAll,
  allSelectedText,
  error,
  hint,
  required,
  disabled,
  title,
  leftIcon,
  style,
  testID,
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const chosen = options.filter((o) => values.includes(o.value));
  const text =
    chosen.length === 0
      ? undefined
      : allSelectedText && options.length > 0 && chosen.length === options.length
        ? allSelectedText
        : chosen.length <= 2
          ? chosen.map((o) => o.label).join(', ')
          : `${chosen.length} selected`;
  return (
    <>
      <PickerTrigger
        label={label}
        required={required}
        error={error}
        hint={hint}
        disabled={disabled}
        text={text}
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
        selected={values}
        multiple
        searchable={searchable}
        selectAll={selectAll}
        onToggle={(v) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v])}
        onSelectAll={(all) => onChange(all ? options.filter((o) => !o.disabled).map((o) => o.value) : [])}
      />
    </>
  );
}
