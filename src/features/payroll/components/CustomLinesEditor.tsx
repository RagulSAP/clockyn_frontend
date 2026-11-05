import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { Button, IconButton, TextField } from '@/components/ui';
import { newCustomLine, type CustomLine } from '../utils/payslipForm';

export interface CustomLinesEditorProps {
  lines: CustomLine[];
  onChange: (lines: CustomLine[]) => void;
  /** Row name placeholder ("Earning name" / "Deduction name"). */
  namePlaceholder: string;
  addLabel: string;
  /** Inline error per row id. */
  errors?: Record<string, string>;
  disabled?: boolean;
  testIDPrefix: string;
}

/** Dynamic custom earning / deduction rows: name + amount + remove, and an "add" button. */
export function CustomLinesEditor({ lines, onChange, namePlaceholder, addLabel, errors, disabled, testIDPrefix }: CustomLinesEditorProps) {
  const update = (id: string, patch: Partial<CustomLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <View style={{ gap: spacing.md }}>
      {lines.map((line, index) => (
        <View key={line.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <TextField
            style={{ flex: 1 }}
            value={line.name}
            onChangeText={(name) => update(line.id, { name })}
            placeholder={namePlaceholder}
            accessibilityLabel={`${namePlaceholder} ${index + 1}`}
            editable={!disabled}
            testID={`${testIDPrefix}-name-${index}`}
          />
          <TextField
            style={{ width: 120 }}
            value={line.amount}
            onChangeText={(amount) => update(line.id, { amount })}
            placeholder="0"
            accessibilityLabel={`${namePlaceholder} amount ${index + 1}`}
            inputMode="decimal"
            keyboardType="decimal-pad"
            error={errors?.[line.id] || null}
            editable={!disabled}
            testID={`${testIDPrefix}-amount-${index}`}
          />
          <IconButton
            icon="x"
            variant="plain"
            accessibilityLabel={`Remove ${namePlaceholder.toLowerCase()} ${index + 1}`}
            onPress={() => onChange(lines.filter((l) => l.id !== line.id))}
            disabled={disabled}
            testID={`${testIDPrefix}-remove-${index}`}
          />
        </View>
      ))}
      <View style={{ flexDirection: 'row' }}>
        <Button
          title={addLabel}
          icon="plus"
          size="sm"
          variant="secondary"
          onPress={() => onChange([...lines, newCustomLine()])}
          disabled={disabled}
          testID={`${testIDPrefix}-add`}
        />
      </View>
    </View>
  );
}
