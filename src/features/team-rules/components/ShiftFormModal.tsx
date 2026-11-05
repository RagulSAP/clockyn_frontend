import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Modal, Text, TextField, TimeField } from '@/components/ui';
import { spacing } from '@/theme';
import type { Shift } from '@/types/api/shifts';

import { hasShiftErrors, shiftDurationLabel, validateShiftForm, type ShiftFormErrors, type ShiftFormValues } from '../utils/shiftTime';

export type ShiftFormModalProps = {
  visible: boolean;
  /** Shift being edited; `null` = add mode. */
  editing: Shift | null;
  existing: readonly Shift[];
  saving: boolean;
  onClose: () => void;
  /** Resolves true when the shift was saved (the screen closes the modal). */
  onSubmit: (values: ShiftFormValues) => Promise<void> | void;
};

const EMPTY: ShiftFormValues = { name: '', startTime: '', endTime: '' };

/** Add / edit shift dialog with inline validation (v1 silently ignored empty fields and hid the server's message). */
export function ShiftFormModal(props: ShiftFormModalProps) {
  // The dialog only exists while open, so every opening starts from a fresh form (no reset effect needed).
  if (!props.visible) return null;
  return <ShiftFormDialog key={props.editing?.id ?? 'new'} {...props} />;
}

function ShiftFormDialog({ visible, editing, existing, saving, onClose, onSubmit }: ShiftFormModalProps) {
  const [values, setValues] = useState<ShiftFormValues>(
    editing ? { name: editing.name, startTime: editing.startTime, endTime: editing.endTime } : EMPTY,
  );
  const [errors, setErrors] = useState<ShiftFormErrors>({});

  const patch = (p: Partial<ShiftFormValues>) => {
    setValues((v) => ({ ...v, ...p }));
    setErrors({});
  };

  const submit = () => {
    const found = validateShiftForm(values, existing, editing?.id ?? null);
    setErrors(found);
    if (hasShiftErrors(found)) return;
    void onSubmit({ ...values, name: values.name.trim() });
  };

  const duration = values.startTime && values.endTime ? shiftDurationLabel(values.startTime, values.endTime) : null;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      title={editing ? 'Edit Shift' : 'Add New Shift'}
      testID="shift-form-modal"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title={editing ? 'Update' : 'Add'} onPress={submit} loading={saving} style={{ flex: 1 }} testID="shift-form-submit" />
        </View>
      }
    >
      <View style={{ gap: spacing.lg }}>
        <TextField
          label="Shift Name"
          value={values.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Enter shift name"
          error={errors.name}
          required
          testID="shift-name"
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TimeField
            label="Start Time"
            value={values.startTime}
            onChange={(startTime) => patch({ startTime })}
            placeholder="Select start time"
            error={errors.startTime}
            required
            style={{ flex: 1 }}
            testID="shift-start"
          />
          <TimeField
            label="End Time"
            value={values.endTime}
            onChange={(endTime) => patch({ endTime })}
            placeholder="Select end time"
            error={errors.endTime}
            required
            style={{ flex: 1 }}
            testID="shift-end"
          />
        </View>
        {duration && !errors.form ? (
          <Text variant="caption" color="textMuted">
            {`Shift length: ${duration}`}
          </Text>
        ) : null}
        {errors.form ? (
          <Text variant="callout" color="danger" testID="shift-form-error">
            {errors.form}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}
