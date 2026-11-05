import React, { useEffect, useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button, IconButton, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

export type DynamicStringListProps = {
  label: string;
  required?: boolean;
  /** Placeholder prefix: `Branch` -> `Branch 1`, `Branch 2`. */
  itemLabel: string;
  addLabel: string;
  values: string[];
  onChange: (index: number, text: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  error?: string;
  testID: string;
};

/** Editable list of names with add / remove (branches and departments). New rows take focus. */
export function DynamicStringList({ label, required, itemLabel, addLabel, values, onChange, onAdd, onRemove, error, testID }: DynamicStringListProps) {
  const refs = useRef<(TextInputInstance | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex === null) return undefined;
    const id = setTimeout(() => {
      refs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }, 100);
    return () => clearTimeout(id);
  }, [focusIndex]);

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <Text variant="callout" weight="semibold" color="textSecondary">
        {label}
        {required ? <Text variant="callout" color="danger">{' *'}</Text> : null}
      </Text>
      {values.map((value, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <TextField
              ref={(node) => {
                refs.current[index] = node;
              }}
              value={value}
              onChangeText={(text) => onChange(index, text)}
              placeholder={`${itemLabel} ${index + 1}`}
              error={index === 0 ? error : undefined}
              testID={`${testID}-${index}`}
            />
          </View>
          {values.length > 1 ? (
            <IconButton icon="minus" variant="tonal" accessibilityLabel={`Remove ${itemLabel} ${index + 1}`} onPress={() => onRemove(index)} testID={`${testID}-remove-${index}`} />
          ) : null}
        </View>
      ))}
      <Button
        title={addLabel}
        icon="plus"
        variant="secondary"
        size="sm"
        onPress={() => {
          onAdd();
          setFocusIndex(values.length);
        }}
        testID={`${testID}-add`}
      />
    </View>
  );
}
