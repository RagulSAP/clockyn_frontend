import React from 'react';
import { View } from 'react-native';

import { Button, IconButton, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { listAdd, listRemove, listUpdate } from '../utils/companyForm';

export type TextListEditorProps = {
  /** Singular noun for labels: "Branch" -> "Branch 1", "+ Add Branch". */
  noun: string;
  values: string[];
  onChange: (values: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  testID: string;
};

/** Repeatable text inputs (branches / departments). Rows can be removed while more than one remains. */
export function TextListEditor({ noun, values, onChange, required, disabled, testID }: TextListEditorProps) {
  return (
    <View style={{ gap: spacing.md }}>
      {values.map((value, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <TextField
            label={`${noun} ${i + 1}`}
            value={value}
            onChangeText={(t) => onChange(listUpdate(values, i, t))}
            placeholder={`Enter ${noun.toLowerCase()} ${i + 1}`}
            required={required}
            editable={!disabled}
            style={{ flex: 1 }}
            testID={`${testID}-${i}`}
          />
          {values.length > 1 ? (
            <IconButton
              icon="minus"
              variant="tonal"
              color="danger"
              accessibilityLabel={`Remove ${noun.toLowerCase()} ${i + 1}`}
              onPress={() => onChange(listRemove(values, i))}
              disabled={disabled}
              testID={`${testID}-remove-${i}`}
            />
          ) : null}
        </View>
      ))}
      <Button
        title={`Add ${noun}`}
        icon="plus"
        variant="secondary"
        size="sm"
        onPress={() => onChange(listAdd(values))}
        disabled={disabled}
        style={{ alignSelf: 'flex-start' }}
        testID={`${testID}-add`}
      />
    </View>
  );
}
