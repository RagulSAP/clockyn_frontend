import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Icon, IconButton, Modal, Text, TextField } from '@/components/ui';
import { formatINR } from '@/lib/format';
import { formatDate } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { OdometerReading } from '@/types/api/expenses';

import { formatKm, parseRate, readingAmount, readingDistance } from '../utils/odometerMath';
import { ReviewActions, ReviewHeader } from './ReviewParts';

/** Org allowance rate (INR per km, a whole number) with the edit button. */
export function RateCard({ rate, onEdit }: { rate: number; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="fuel" size={24} color="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color="textMuted">
            Allowance Rate
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
            <Text variant="title1" testID="odometer-rate">{`₹${rate}`}</Text>
            <Text variant="callout" color="textMuted">
              per km
            </Text>
          </View>
        </View>
        <IconButton icon="edit" variant="tonal" accessibilityLabel="Edit allowance rate" onPress={onEdit} testID="odometer-edit-rate" />
      </View>
    </Card>
  );
}

/** Rate editor: whole rupees per km (the server stores an integer); decimals are rounded. Mount it only while open (fresh state per open). */
export function EditRateModal({
  visible,
  initial,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial: number;
  saving: boolean;
  onClose: () => void;
  onSave: (rate: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string | undefined>();
  const parsed = parseRate(value);
  const hint = parsed.ok && parsed.rounded ? `Saved as ₹${parsed.value} per km (whole rupees only)` : 'Whole rupees per km';

  const submit = async () => {
    const p = parseRate(value);
    if (!p.ok) {
      setError(p.error);
      return;
    }
    setError(undefined);
    if (await onSave(p.value)) onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Edit Allowance Rate"
      size="sm"
      dismissible={!saving}
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.xs }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={saving} style={{ flex: 1 }} />
          <Button title="Save Rate" onPress={() => void submit()} loading={saving} style={{ flex: 1 }} testID="odometer-save-rate" />
        </View>
      }
    >
      <TextField
        label={'Rate per KM (₹)'}
        value={value}
        onChangeText={(t) => {
          setValue(t);
          setError(undefined);
        }}
        placeholder="Enter rate"
        keyboardType="decimal-pad"
        prefix={'₹'}
        error={error}
        hint={error ? undefined : hint}
        onSubmitEditing={() => void submit()}
        testID="odometer-rate-input"
      />
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="micro" color="textMuted">
        {label.toUpperCase()}
      </Text>
      <Text variant="title3" color={tone}>
        {value}
      </Text>
    </View>
  );
}

/** One odometer submission: start -> distance -> stop, totals, photos and (while pending) the decision buttons. */
export function OdometerCard({
  reading,
  rate,
  busy,
  onPhotos,
  onDecide,
}: {
  reading: OdometerReading;
  rate: number;
  busy: boolean;
  onPhotos: () => void;
  onDecide: (status: 'approved' | 'rejected') => void;
}) {
  const { colors } = useTheme();
  const distance = readingDistance(reading);
  const amount = readingAmount(reading, rate);
  const km = (v: number | undefined) => (v === undefined ? '0 km' : `${v} km`);
  return (
    <Card style={{ gap: spacing.md }} testID={`odometer-${reading.readingId}`}>
      <ReviewHeader name={reading.userName || 'Unknown User'} line={formatDate(reading.date)} status={reading.status} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md }}>
        <Stat label="Start" value={km(reading.startKm)} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Icon name="arrow-right" size={18} color="textMuted" />
          <Text variant="caption" color="primary" weight="bold">
            {formatKm(distance, 1)}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="micro" color="textMuted">
            STOP
          </Text>
          <Text variant="title3">{km(reading.stopKm)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Stat label="Total Distance" value={formatKm(distance)} />
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="micro" color="textMuted">
            AMOUNT
          </Text>
          <Text variant="title3" color="success" testID={`odometer-${reading.readingId}-amount`}>
            {formatINR(amount, { decimals: 2 })}
          </Text>
        </View>
      </View>
      <ReviewActions
        pending={reading.status === 'pending'}
        busy={busy}
        photoLabel="Photos"
        onPhotos={onPhotos}
        onReject={() => onDecide('rejected')}
        onApprove={() => onDecide('approved')}
        testID={`odometer-${reading.readingId}`}
      />
    </Card>
  );
}
