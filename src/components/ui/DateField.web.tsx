import React from 'react';
import { WebInputField } from './internal/WebInputField';
import type { DateFieldProps } from './DateField';

export type { DateFieldProps } from './DateField';

/** Web date field: the browser's native `<input type=date>` (keyboard + picker support built in). */
export function DateField({ label, value, onChange, minDate, maxDate, error, hint, required, disabled, style, testID }: DateFieldProps) {
  return (
    <WebInputField
      type="date"
      label={label}
      value={value}
      onChange={onChange}
      min={minDate}
      max={maxDate}
      error={error}
      hint={hint}
      required={required}
      disabled={disabled}
      leftIcon="calendar"
      style={style}
      testID={testID}
    />
  );
}
