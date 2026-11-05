import React from 'react';
import { View } from 'react-native';

import { Card, DateField, Divider, Icon, Select, Text, TextField } from '@/components/ui';
import { formatDate, todayIST } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';

import {
  FIELD_RULES,
  optionsWithCurrent,
  type FieldDef,
  type FieldKey,
  type PersonalDraft,
  type SectionDef,
} from '../utils/personalDetails';

/** Read-only row: small caps label over the value (`—` when empty). */
export function InfoRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={{ gap: 2, paddingVertical: spacing.sm }} testID={testID}>
      <Text variant="micro" color="textMuted" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text variant="body">{value || '—'}</Text>
    </View>
  );
}

function viewValue(def: FieldDef, value: string): string {
  return def.type === 'date' && value ? formatDate(value, 'dd/MM/yyyy') : value;
}

interface FieldProps {
  def: FieldDef;
  draft: PersonalDraft;
  error?: string;
  onChange: (key: FieldKey, text: string) => void;
  onPick: (key: FieldKey, value: string) => void;
}

/** One editable field with the v1 hint in the label and the inline error under it. */
export function EditField({ def, draft, error, onChange, onPick }: FieldProps) {
  const rule = FIELD_RULES[def.key];
  const label = rule ? `${def.label} (${rule.hint})` : def.label;
  const placeholder = `Enter ${def.label.toLowerCase()}`;
  const value = draft[def.key];
  if (def.type === 'select') {
    return (
      <Select
        label={def.label}
        value={value || null}
        options={optionsWithCurrent(def.options ?? [], value)}
        onChange={(v) => onPick(def.key, v)}
        placeholder={`Select ${def.label.toLowerCase()}`}
        testID={`field-${def.key}`}
      />
    );
  }
  if (def.type === 'date') {
    return <DateField label={def.label} value={value} onChange={(v) => onPick(def.key, v)} maxDate={def.key === 'dob' ? todayIST() : undefined} testID={`field-${def.key}`} />;
  }
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(t) => onChange(def.key, t)}
      placeholder={placeholder}
      error={error || null}
      keyboardType={def.type === 'number' ? 'number-pad' : def.type === 'email' ? 'email-address' : 'default'}
      autoCapitalize={def.type === 'email' ? 'none' : def.key === 'pan' || def.key === 'ifsc' ? 'characters' : 'sentences'}
      multiline={def.type === 'multiline'}
      numberOfLines={def.type === 'multiline' ? 3 : undefined}
      maxLength={rule?.maxLen}
      testID={`field-${def.key}`}
    />
  );
}

export interface SectionCardProps extends Omit<FieldProps, 'def' | 'error'> {
  section: SectionDef;
  isEdit: boolean;
  errors: Partial<Record<FieldKey, string>>;
}

/** Card with an icon header and either the read-only rows or the edit fields of one section. */
export function SectionCard({ section, isEdit, draft, errors, onChange, onPick }: SectionCardProps) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.md }} testID={`section-${section.key}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={section.icon} size={18} color="primary" />
        </View>
        <Text variant="title3">{section.title}</Text>
      </View>
      {isEdit ? (
        <View style={{ gap: spacing.md }}>
          {section.fields.map((def) => (
            <EditField key={def.key} def={def} draft={draft} error={errors[def.key]} onChange={onChange} onPick={onPick} />
          ))}
        </View>
      ) : (
        <View>
          {section.fields.map((def, i) => (
            <View key={def.key}>
              {i > 0 ? <Divider /> : null}
              <InfoRow label={def.label} value={viewValue(def, draft[def.key])} testID={`row-${def.key}`} />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
