import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { expensesApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, Icon, LoadingOverlay, Text, TextField, useToast, type IconName } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, todayIST } from '@/lib/datetime';
import { queryKeys } from '@/lib/query/queryKeys';
import type { PickedImage } from '@/lib/platform/media';
import { useSession } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import type { ExpenseType } from '@/types/api/expenses';

import { DateNavigator } from '../components/DateNavigator';
import { ExpenseListCard } from '../components/ExpenseListCard';
import { PhotoCapture } from '../components/PhotoCapture';
import { SuccessModal } from '../components/SuccessModal';
import { useExpenseList } from '../hooks/useExpenseData';
import { MISSING_PHOTO_OR_AMOUNT, parseExpenseAmount, submitExpenseWithPhoto, validateExpenseAmount } from '../utils/expenseRules';

export type ExpenseScreenConfig = {
  /** Sent to the API (`travel` / `bill`); lists are queried with the upper-case form by the API module. */
  type: ExpenseType;
  title: string;
  listTitle: string;
  columnLabel: string;
  emptyTitle: string;
  emptyMessage: (date: string) => string;
  placeholderIcon: IconName;
  addTitle: string;
  addSubtitle: string;
  /** Field label above the photo box ("Ticket Photo" / "Bill Photo"). */
  photoLabel: string;
  uploadTitle: string;
  uploadSubtitle: string;
  submitLabel: string;
  successTitle: string;
  successMessage: string;
  failureFallback: string;
  /** Noun used in the retry banner ("ticket" / "bill"). */
  noun: string;
};

/** A saved record whose photo failed to upload; "Retry upload" re-sends only the photo (no second record). */
type PendingPhoto = { expenseId: string; date: string };

/** Shared screen of travel tickets and other bills: date navigator, submitted list + total, add form. */
export function ExpenseUploadScreen({ config }: { config: ExpenseScreenConfig }) {
  const toast = useToast();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { isDesktop } = useBreakpoint();
  const userId = useSession()?.userId ?? '';
  const today = todayIST();

  const [date, setDate] = useState(today);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState<string | undefined>();
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const list = useExpenseList(config.type, date);
  const expenses = useMemo(() => list.data ?? [], [list.data]);

  const refreshLists = () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(userId) });

  const submit = useAsyncAction(
    async (): Promise<boolean> => {
      if (!photo || !amount.trim()) {
        toast.error(MISSING_PHOTO_OR_AMOUNT);
        return false;
      }
      const problem = pending ? null : validateExpenseAmount(amount);
      if (problem) {
        setAmountError(problem);
        toast.error(problem);
        return false;
      }
      setAmountError(undefined);
      const value = parseExpenseAmount(amount) ?? 0;
      const recordDate = pending?.date ?? date;
      const file = { uri: photo.uri, fileName: photo.fileName, mimeType: photo.mimeType };
      const outcome = await submitExpenseWithPhoto(
        {
          create: () => expensesApi.submitExpense({ userId, date: recordDate, type: config.type, amount: value }),
          upload: (expenseId) => expensesApi.uploadExpensePhoto({ userId, expenseId, file }),
        },
        pending?.expenseId,
      );
      await refreshLists();
      if (outcome.status === 'photo_failed') {
        setPending({ expenseId: outcome.expenseId, date: recordDate });
        toast.error(`Saved, but the photo failed to upload: ${getErrorMessage(outcome.error, 'Upload failed')}`);
        return false;
      }
      return true;
    },
    {
      errorMessage: config.failureFallback,
      onSuccess: (ok) => {
        if (!ok) return;
        setPending(null);
        setPhoto(null);
        setAmount('');
        setShowSuccess(true);
      },
    },
  );

  const changeDate = (next: string) => {
    if (next !== date) setDate(next);
  };

  const retrying = pending !== null;

  const listColumn = (
    <View style={{ gap: spacing.lg }}>
      <DateNavigator testID="expense-date" date={date} today={today} onChange={changeDate} disabled={submit.loading} />
      <ExpenseListCard
        title={config.listTitle}
        columnLabel={config.columnLabel}
        emptyTitle={config.emptyTitle}
        emptyMessage={config.emptyMessage(formatDate(date))}
        placeholderIcon={config.placeholderIcon}
        expenses={expenses}
        loading={list.isPending}
        failed={list.isError}
        onRetry={() => void list.refetch()}
      />
    </View>
  );

  const formColumn = (
    <View style={{ gap: spacing.lg }}>
      {retrying ? (
        <View
          testID="photo-retry-banner"
          style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, borderRadius: 16, backgroundColor: colors.warningSoft }}
        >
          <Icon name="alert" size={22} color="warning" />
          <Text variant="callout" style={{ flex: 1 }}>
            Your {config.noun} for {formatDate(pending?.date)} was saved, but its photo could not be uploaded. Check the photo below and retry the upload.
          </Text>
        </View>
      ) : null}
      <Card style={{ gap: spacing.lg }} testID="expense-form">
        <View style={{ gap: spacing.xs }}>
          <Text variant="title3">{config.addTitle}</Text>
          <Text variant="callout" color="textSecondary">
            {config.addSubtitle}
          </Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text variant="callout" weight="semibold" color="textSecondary">
            {config.photoLabel}
          </Text>
          <PhotoCapture photo={photo} onChange={setPhoto} title={config.uploadTitle} subtitle={config.uploadSubtitle} disabled={submit.loading} testID="expense-photo" />
        </View>
        <TextField
          label="Amount"
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            if (amountError) setAmountError(undefined);
          }}
          prefix={'₹'}
          placeholder="0.00"
          keyboardType="decimal-pad"
          editable={!retrying && !submit.loading}
          error={amountError}
          testID="expense-amount"
        />
      </Card>
    </View>
  );

  return (
    <Screen
      title={config.title}
      maxWidth={isDesktop ? 1040 : 720}
      testID="expense-upload-screen"
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}
      footer={
        <Button
          title={retrying ? 'Retry photo upload' : config.submitLabel}
          icon={retrying ? 'refresh' : 'send'}
          fullWidth
          loading={submit.loading}
          disabled={submit.loading || !amount.trim() || !photo}
          onPress={() => void submit.run()}
          testID="expense-submit"
        />
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{listColumn}</View>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{formColumn}</View>
      </View>
      <LoadingOverlay visible={submit.loading} message="Loading..." />
      <SuccessModal
        visible={showSuccess}
        title={config.successTitle}
        message={config.successMessage}
        actionLabel="Done"
        onClose={() => setShowSuccess(false)}
        testID="expense-success-modal"
      />
    </Screen>
  );
}
