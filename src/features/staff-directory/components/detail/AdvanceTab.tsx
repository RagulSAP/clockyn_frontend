import React, { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, DateField, EmptyState, ErrorState, Icon, Modal, SegmentedControl, SkeletonList, Text, TextField } from '@/components/ui';
import { formatDate, todayIST } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';
import type { Advance } from '@/types/api/salaryReports';

import { useAdvanceHistory } from '../../hooks/useStaffExtras';
import { useCreateAdvance } from '../../hooks/useStaffMutations';
import { sanitizeAmountInput, validateAdvance, type AdvanceField } from '../../utils/advance';

type SubTab = 'add' | 'view';

export interface AdvanceTabProps {
  staffId: string;
  staffName: string;
}

/** Name of the admin who recorded an advance (kept in the raw row; the DTO only carries the id). */
function createdByName(a: Advance): string | undefined {
  const v = a.raw.created_by_name;
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Advance salary: add a record (validated) and review the history. */
export function AdvanceTab({ staffId, staffName }: AdvanceTabProps) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<SubTab>('add');
  const [date, setDate] = useState(() => todayIST());
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Partial<Record<AdvanceField, string>>>({});
  const [saved, setSaved] = useState(false);

  const history = useAdvanceHistory(staffId, true);
  const create = useCreateAdvance(staffId, () => {
    setAmount('');
    setDate(todayIST());
    setErrors({});
    setSaved(true);
    setTab('view');
  });

  const submit = () => {
    const result = validateAdvance({ date, amount }, todayIST());
    if (!result.ok) {
      setErrors({ [result.field]: result.message });
      return;
    }
    setErrors({});
    create.mutate({ amount: result.amount, date: result.date });
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <SegmentedControl<SubTab>
        options={[
          { label: 'Add Advance', value: 'add', icon: 'plus' },
          { label: 'View Advance', value: 'view', icon: 'list' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'add' ? (
        <Card style={{ gap: spacing.lg }}>
          <TextField label="Employee Name" value={staffName} onChangeText={() => undefined} editable={false} required leftIcon="user" />
          <DateField
            label="Date"
            value={date}
            onChange={(v) => {
              setDate(v);
              setErrors((e) => ({ ...e, date: undefined }));
            }}
            maxDate={todayIST()}
            error={errors.date}
            required
          />
          <TextField
            label="Advance Amount (₹)"
            value={amount}
            onChangeText={(t) => {
              setAmount(sanitizeAmountInput(t));
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="0.00"
            prefix="₹"
            keyboardType="decimal-pad"
            error={errors.amount}
            required
            onSubmitEditing={submit}
            testID="advance-amount"
          />
          <Button title={create.isPending ? 'Saving...' : 'Save Advance'} icon="check" loading={create.isPending} disabled={create.isPending} onPress={submit} fullWidth />
        </Card>
      ) : history.isLoading ? (
        <SkeletonList count={3} />
      ) : history.isError ? (
        <ErrorState compact message={history.errorMessage} onRetry={history.refetch} />
      ) : history.advances.length === 0 ? (
        <EmptyState compact icon="banknote" title="No advance records" />
      ) : (
        <View style={{ gap: spacing.sm }} testID="advance-history">
          {history.advances.map((a, i) => {
            const by = createdByName(a);
            return (
              <Card key={a.id || `${a.date}-${i}`} padding={spacing.md}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="banknote" size={20} color="success" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{formatINR(a.amount, { decimals: 2 })}</Text>
                    <Text variant="caption" color="textMuted">
                      {a.date ? formatDate(a.date) : '-'}
                    </Text>
                    {by ? (
                      <Text variant="caption" color="textMuted">
                        {`By: ${by}`}
                      </Text>
                    ) : null}
                  </View>
                  <Badge label="Paid" tone="success" size="sm" />
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Modal
        visible={saved}
        onClose={() => setSaved(false)}
        size="sm"
        footer={<Button title="Done" onPress={() => setSaved(false)} fullWidth />}
      >
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={32} color="success" />
          </View>
          <Text variant="title2">Advance Saved!</Text>
          <Text variant="body" color="textSecondary" align="center">
            {`Advance salary has been recorded for ${staffName}.`}
          </Text>
        </View>
      </Modal>
    </View>
  );
}
