import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, FilterChips, Modal, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import {
  WEEKDAY_LABELS,
  monthTitle,
  offDaysSummary,
  plural,
  toggleDate,
  type HolidayGroup,
} from '../utils/holidayLogic';
import { BlockAttendanceSwitch } from './HolidayForms';
import { HolidayMonthGrid } from './HolidayMonthGrid';

type MonthProps = { year: number; month: number; offDays: readonly number[]; holidayDates: readonly string[] };

// ─── edit ─────────────────────────────────────────────────────────────────────────────────────

export type HolidayEditModalProps = MonthProps & {
  group: HolidayGroup | null;
  saving: boolean;
  onClose: () => void;
  onSave: (v: { name: string; dates: string[]; blockAttendance: boolean }) => void;
};

/** Rename, change the punch policy and add / remove dates of one holiday (within the visible month). */
export function HolidayEditModal(props: HolidayEditModalProps) {
  // Keyed by holiday: opening a different one starts fresh, while a background refetch never wipes the user's edits.
  if (!props.group) return null;
  return <HolidayEditDialog key={props.group.key} {...props} group={props.group} />;
}

function HolidayEditDialog({ group, year, month, offDays, holidayDates, saving, onClose, onSave }: HolidayEditModalProps & { group: HolidayGroup }) {
  const [name, setName] = useState(group.name);
  const [dates, setDates] = useState<string[]>(() => group.entries.map((e) => e.date));
  const [block, setBlock] = useState(group.blockAttendance);

  const canSave = name.trim() !== '' && dates.length > 0 && !saving;

  return (
    <Modal
      visible
      onClose={onClose}
      dismissible={!saving}
      title="Edit Holiday"
      size="md"
      testID="holiday-edit-modal"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button
            title="Save"
            onPress={() => onSave({ name: name.trim(), dates, blockAttendance: block })}
            loading={saving}
            disabled={!canSave}
            style={{ flex: 1 }}
            testID="holiday-edit-save"
          />
        </View>
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Text variant="callout" color="textSecondary">
          Change name and/or dates
        </Text>
        <TextField label="Holiday Name" value={name} onChangeText={setName} placeholder="Holiday name" required autoFocus testID="holiday-edit-name" />
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="semibold" color="textSecondary">
            {`Select Dates (${monthTitle(year, month)})`}
          </Text>
          <HolidayMonthGrid
            year={year}
            month={month}
            hideHeader
            offDays={offDays}
            holidayDates={holidayDates}
            selected={dates}
            onToggle={(d) => setDates((cur) => toggleDate(cur, d))}
            testID="holiday-edit-grid"
          />
          <Text variant="caption" color="textMuted">
            {`${plural(dates.length, 'date', 'dates')} selected`}
          </Text>
        </View>
        <BlockAttendanceSwitch value={block} onChange={setBlock} />
      </View>
    </Modal>
  );
}

// ─── add dates ────────────────────────────────────────────────────────────────────────────────

export type AddDatesModalProps = MonthProps & {
  group: HolidayGroup | null;
  saving: boolean;
  onClose: () => void;
  onAdd: (dates: string[]) => void;
};

/** Pick more dates (same name, scope and policy) for an existing holiday. */
export function AddDatesModal(props: AddDatesModalProps) {
  if (!props.group) return null;
  return <AddDatesDialog key={props.group.key} {...props} group={props.group} />;
}

function AddDatesDialog({ group, year, month, offDays, holidayDates, saving, onClose, onAdd }: AddDatesModalProps & { group: HolidayGroup }) {
  const [picked, setPicked] = useState<string[]>([]);
  const existing = group.entries.map((e) => e.date);

  return (
    <Modal
      visible
      onClose={onClose}
      dismissible={!saving}
      title={`Add Dates - ${group.name}`}
      size="md"
      testID="holiday-add-dates-modal"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button
            title={picked.length > 0 ? `Add (${picked.length})` : 'Add'}
            onPress={() => onAdd(picked)}
            loading={saving}
            disabled={picked.length === 0 || saving}
            style={{ flex: 1 }}
            testID="holiday-add-dates-submit"
          />
        </View>
      }
    >
      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          {`Tap dates to add (${monthTitle(year, month)})`}
        </Text>
        <HolidayMonthGrid
          year={year}
          month={month}
          hideHeader
          offDays={offDays}
          holidayDates={[...new Set([...holidayDates, ...existing])]}
          lockedDates={existing}
          selected={picked}
          onToggle={(d) => setPicked((cur) => toggleDate(cur, d))}
          testID="holiday-add-dates-grid"
        />
      </View>
    </Modal>
  );
}

// ─── weekly off days ──────────────────────────────────────────────────────────────────────────

export type OffDaysModalProps = {
  visible: boolean;
  offDays: readonly number[];
  saving: boolean;
  onClose: () => void;
  onSave: (days: number[]) => void;
};

/** Seven weekday chips (Mon = 0 ... Sun = 6). Saving an empty selection is allowed. */
export function OffDaysModal(props: OffDaysModalProps) {
  if (!props.visible) return null;
  return <OffDaysDialog {...props} />;
}

function OffDaysDialog({ visible, offDays, saving, onClose, onSave }: OffDaysModalProps) {
  const [temp, setTemp] = useState<number[]>([...offDays]);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      dismissible={!saving}
      title="Configure Off Days"
      testID="off-days-modal"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title="Save" onPress={() => onSave(temp)} loading={saving} style={{ flex: 1 }} testID="off-days-save" />
        </View>
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Text variant="callout" color="textSecondary">
          Select which days of the week are off
        </Text>
        <FilterChips<number>
          multiple
          scroll={false}
          options={WEEKDAY_LABELS.map((label, i) => ({ label, value: i }))}
          value={temp}
          onChange={(v) => setTemp([...v].sort((a, b) => a - b))}
        />
        <Text variant="callout" weight="semibold" testID="off-days-summary">
          {offDaysSummary(temp)}
        </Text>
      </View>
    </Modal>
  );
}
