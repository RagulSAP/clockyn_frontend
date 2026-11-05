import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, IconButton, Modal, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { applyStaffInput } from '../utils/pricing';

export type StaffStepperProps = {
  value: number;
  min: number;
  onChange: (value: number) => void;
};

/** Staff capacity stepper: minus / plus (no maximum) and tap-the-number to type a value. */
export function StaffStepper({ value, min, onChange }: StaffStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const open = () => {
    setDraft(String(value));
    setEditing(true);
  };
  const apply = () => {
    onChange(applyStaffInput(draft, min, value));
    setEditing(false);
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <IconButton
          icon="minus"
          variant="tonal"
          accessibilityLabel="Decrease staff count"
          disabled={value <= min}
          onPress={() => onChange(Math.max(min, value - 1))}
          testID="staff-minus"
        />
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Set staff count" testID="staff-value">
          <Text variant="display" align="center" style={{ minWidth: 88 }}>
            {value}
          </Text>
        </Pressable>
        <IconButton icon="plus" variant="filled" accessibilityLabel="Increase staff count" onPress={() => onChange(value + 1)} testID="staff-plus" />
      </View>
      <Text variant="caption" color="textMuted">
        staff members
      </Text>

      <Modal
        visible={editing}
        onClose={() => setEditing(false)}
        title="Set Staff Count"
        size="sm"
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button title="Apply" onPress={apply} style={{ flex: 1 }} testID="staff-apply" />
          </View>
        }
      >
        <Text variant="callout" color="textSecondary" style={{ marginBottom: spacing.md }}>
          {`Minimum: ${min} staff`}
        </Text>
        <TextField
          value={draft}
          onChangeText={setDraft}
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={apply}
          accessibilityLabel="Staff count"
          testID="staff-input"
        />
      </Modal>
    </View>
  );
}
