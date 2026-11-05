import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, IconButton, Modal, Text, TextField } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { displayDate } from '../../utils/dates';
import { DatePickerModal } from '../DatePickerModal';

export interface CfrModalProps {
  /** Lead the request is for (`null` = closed). */
  leadName: string | null;
  sending: boolean;
  /** Called with the trimmed reason and the optional forward date (`YYYY-MM-DD` or ''). */
  onSubmit: (reason: string, forwardDate: string) => void;
  onClose: () => void;
}

/**
 * Carry Forward Request dialog: reason (required) + optional forward date. The forward-date calendar is this
 * dialog's own picker (v1 shared one calendar whose mode was never reset) and its value is cleared whenever the
 * dialog closes (v1 kept it after Cancel).
 */
export function CfrModal({ leadName, sending, onSubmit, onClose }: CfrModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');
  const [forwardDate, setForwardDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const open = leadName !== null;
  const [wasOpen, setWasOpen] = useState(open);
  // Closing clears the reason and the forward date (state adjusted during render, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setReason('');
      setForwardDate('');
      setDateOpen(false);
    }
  }

  const canSend = reason.trim() !== '' && !sending;

  return (
    <>
      <Modal
        visible={open}
        onClose={onClose}
        title="Carry Forward Request"
        size="sm"
        testID="crm-cfr-modal"
        footer={
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button title="Send Request" icon="send" disabled={!canSend} loading={sending} onPress={() => onSubmit(reason.trim(), forwardDate)} testID="crm-cfr-send" />
          </View>
        }
      >
        <View style={{ gap: spacing.lg }}>
          <Text variant="callout" color="textSecondary" numberOfLines={1}>
            {leadName ?? ''}
          </Text>
          <TextField
            label="Reason"
            required
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            autoFocus
            placeholder="Explain why this lead needs to be carried forward to the next day..."
            testID="crm-cfr-reason"
          />
          <View style={{ gap: spacing.xs }}>
            <Text variant="callout" weight="semibold" color="textSecondary">
              Forward to Date (optional)
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forward to date"
              onPress={() => setDateOpen(true)}
              testID="crm-cfr-date"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                height: 50,
                paddingHorizontal: spacing.lg,
                borderRadius: radii.md,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Icon name="calendar" size={18} color="textMuted" />
              <Text variant="body" color={forwardDate ? 'text' : 'textMuted'} style={{ flex: 1 }}>
                {forwardDate ? displayDate(forwardDate) : 'Select forward date'}
              </Text>
              {forwardDate ? <IconButton icon="x" size="sm" accessibilityLabel="Clear forward date" onPress={() => setForwardDate('')} /> : <Icon name="chevron-right" size={18} color="textMuted" />}
            </Pressable>
          </View>
        </View>
      </Modal>
      <DatePickerModal visible={dateOpen} value={forwardDate} title="Forward to date" onClose={() => setDateOpen(false)} onSelect={setForwardDate} onClear={() => setForwardDate('')} />
    </>
  );
}
