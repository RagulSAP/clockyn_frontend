import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Card, Text, type IconName } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { spacing } from '@/theme';
import type { Expense, ExpenseType } from '@/types/api/expenses';

import { useExpenseReview } from '../hooks/useExpenseReview';
import { filterByDate } from '../utils/recordFilter';
import { PhotoModal, ReviewActions, ReviewHeader, Thumb } from './ReviewParts';
import { ReviewFrame } from './ReviewFrame';

type Copy = {
  title: string;
  amountLabel: string;
  photoLabel: string;
  modalTitle: string;
  icon: IconName;
  empty: { title: string; message: string };
  /** Extra text after the date (bills: the constant type label). */
  dateSuffix?: string;
};

const COPY: Record<ExpenseType, Copy> = {
  travel: {
    title: 'Travel Tickets',
    amountLabel: 'Ticket Amount',
    photoLabel: 'Photo',
    modalTitle: 'Travel Ticket',
    icon: 'plane',
    empty: { title: 'No Tickets Found', message: 'Travel tickets will appear here once employees submit them' },
  },
  bill: {
    title: 'Other Bills',
    amountLabel: 'Bill Amount',
    photoLabel: 'Photo',
    modalTitle: 'Bill Receipt',
    icon: 'receipt',
    empty: { title: 'No Bills Found', message: 'Bills will appear here once employees submit them' },
    dateSuffix: 'Bill/Invoice',
  },
};

/** Travel tickets and other bills share this screen: photo + amount, date filter, approve / reject (final). */
export function ExpenseReviewScreen({ kind }: { kind: ExpenseType }) {
  const copy = COPY[kind];
  const r = useExpenseReview(kind);
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState<Expense | null>(null);
  const filtered = useMemo(() => filterByDate(r.items, date), [r.items, date]);
  const q = r.query;
  const line = (e: Expense) => [formatDate(e.date), copy.dateSuffix].filter(Boolean).join(' • ');

  return (
    <ReviewFrame
      title={copy.title}
      testID={`expenses-${kind}`}
      date={date}
      onDateChange={setDate}
      shown={filtered.length}
      total={r.items.length}
      loading={q.isPending && !q.data}
      hasError={q.isError}
      hasData={!!q.data}
      error={q.error}
      onRetry={() => void q.refetch()}
      refreshing={r.refreshing}
      onRefresh={() => void r.refresh()}
      busy={r.busy}
      empty={{ icon: copy.icon, ...copy.empty }}
      modals={
        <PhotoModal
          visible={photo !== null}
          onClose={() => setPhoto(null)}
          title={copy.modalTitle}
          photos={[{ label: copy.modalTitle, uri: photo?.photoUrl }]}
          summary={{ name: photo?.userName || 'Unknown', line: photo ? line(photo) : '', amount: formatINR(photo?.amount ?? 0, { decimals: 2 }) }}
        />
      }
    >
      {filtered.map((e) => {
        const amount = formatINR(e.amount, { decimals: 2 });
        return (
          <Card key={e.expenseId || e.id} style={{ gap: spacing.md }} testID={`expense-${e.expenseId}`}>
            <ReviewHeader name={e.userName || 'Unknown'} line={line(e)} status={e.status} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Thumb uri={e.photoUrl} icon={copy.icon} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color="textMuted">
                  {copy.amountLabel}
                </Text>
                <Text variant="title2" color="success">
                  {amount}
                </Text>
              </View>
            </View>
            <ReviewActions
              pending={e.status === 'pending'}
              busy={r.busy}
              photoLabel={copy.photoLabel}
              onPhotos={() => setPhoto(e)}
              onReject={() => void r.decide(e, 'rejected', amount)}
              onApprove={() => void r.decide(e, 'approved', amount)}
              testID={`expense-${e.expenseId}`}
            />
          </Card>
        );
      })}
    </ReviewFrame>
  );
}
