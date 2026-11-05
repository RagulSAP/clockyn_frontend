import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Button, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';

import { composeTime, displayTime, hour12Of, meridiemOf, minuteOf, validatePunchEdit, type Meridiem } from '../../utils/punchClock';

export interface PunchEditSheetProps {
  /** Day being edited (`YYYY-MM-DD`). */
  date: string;
  seedIn: string;
  seedOut: string;
  /** Field that was tapped in the table (the editor opens on it). */
  initialField: 'in' | 'out';
  saving: boolean;
  onClose: () => void;
  onSave: (punchIn: string, punchOut: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function Cell({ label, selected, onPress, width }: { label: string; selected: boolean; onPress: () => void; width: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={{
        width,
        height: 40,
        borderRadius: radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? colors.primary : colors.surfaceMuted,
      }}
    >
      <Text variant="callout" weight="semibold" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Clock-style editor for one day's punch-in / punch-out. Opens on the tapped field (v1 kept stale picker state when
 * the punch-out cell was tapped). Values are 24-hour `HH:mm`.
 */
export function PunchEditSheet({ date, seedIn, seedOut, initialField, saving, onClose, onSave }: PunchEditSheetProps) {
  const { colors } = useTheme();
  const [values, setValues] = useState({ in: seedIn, out: seedOut });
  const [field, setField] = useState<'in' | 'out'>(initialField);
  const [unit, setUnit] = useState<'h' | 'm'>('h');
  const [ampm, setAmpm] = useState<Meridiem>(meridiemOf(initialField === 'in' ? seedIn : seedOut));

  const current = values[field];
  const hour = hour12Of(current);
  const minute = minuteOf(current);
  const unchanged = values.in === seedIn && values.out === seedOut;
  const validation = validatePunchEdit(values.in, values.out);

  const set = (v: string) => setValues((prev) => ({ ...prev, [field]: v }));
  const switchField = (f: 'in' | 'out') => {
    setField(f);
    setUnit('h');
    setAmpm(meridiemOf(values[f]));
  };

  return (
    <BottomSheet
      visible
      onClose={saving ? () => undefined : onClose}
      dismissible={!saving}
      title="Edit Attendance"
      snap="tall"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} fullWidth />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={saving ? 'Saving...' : 'Save Changes'}
              loading={saving}
              disabled={saving || unchanged || !validation.ok}
              onPress={() => onSave(values.in, values.out)}
              fullWidth
              testID="punch-save"
            />
          </View>
        </View>
      }
    >
      <View style={{ gap: spacing.lg }} testID="punch-edit">
        <Text variant="callout" color="textMuted">
          {formatDate(date)}
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {(['in', 'out'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => switchField(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: field === f }}
              accessibilityLabel={f === 'in' ? 'Punch In' : 'Punch Out'}
              style={{
                flex: 1,
                padding: spacing.md,
                borderRadius: radii.md,
                borderWidth: 2,
                borderColor: field === f ? colors.primary : colors.border,
                backgroundColor: field === f ? colors.primarySoft : colors.surface,
              }}
            >
              <Text variant="micro" color="textMuted">
                {f === 'in' ? 'PUNCH IN' : 'PUNCH OUT'}
              </Text>
              <Text variant="title3" color={field === f ? 'primary' : 'text'}>
                {displayTime(values[f])}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Pressable onPress={() => setUnit('h')} accessibilityRole="button" accessibilityLabel="Edit hour" style={{ alignItems: 'center' }}>
            <Text variant="display" color={unit === 'h' ? 'primary' : 'textMuted'}>
              {String(hour).padStart(2, '0')}
            </Text>
            <Text variant="micro" color="textMuted">
              HOUR
            </Text>
          </Pressable>
          <Text variant="display" color="textMuted">
            :
          </Text>
          <Pressable onPress={() => setUnit('m')} accessibilityRole="button" accessibilityLabel="Edit minute" style={{ alignItems: 'center' }}>
            <Text variant="display" color={unit === 'm' ? 'primary' : 'textMuted'}>
              {String(minute).padStart(2, '0')}
            </Text>
            <Text variant="micro" color="textMuted">
              MIN
            </Text>
          </Pressable>
          <View style={{ gap: spacing.xs, marginLeft: spacing.md }}>
            {(['AM', 'PM'] as const).map((m) => (
              <Cell
                key={m}
                label={m}
                width={56}
                selected={ampm === m}
                onPress={() => {
                  setAmpm(m);
                  set(composeTime(hour, minute, m));
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {unit === 'h'
            ? HOURS.map((h) => <Cell key={h} label={String(h)} width={56} selected={current !== '' && hour === h} onPress={() => set(composeTime(h, minute, ampm))} />)
            : MINUTES.map((m) => (
                <Cell key={m} label={String(m).padStart(2, '0')} width={44} selected={current !== '' && minute === m} onPress={() => set(composeTime(hour, m, ampm))} />
              ))}
        </View>
        {!validation.ok ? (
          <Text variant="caption" color="danger">
            {validation.message}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
