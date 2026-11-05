import React from 'react';
import { WebInputField } from './internal/WebInputField';
import type { TimeFieldProps } from './TimeField';

export type { TimeFieldProps } from './TimeField';

/** Web time field: the browser's native `<input type=time>`. */
export function TimeField({ label, value, onChange, error, hint, required, disabled, style, testID }: TimeFieldProps) {
  return (
    <WebInputField
      type="time"
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      required={required}
      disabled={disabled}
      leftIcon="clock"
      style={style}
      testID={testID}
    />
  );
}
