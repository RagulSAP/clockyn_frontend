import React, { useMemo, useState } from 'react';

import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import type { OdometerReading } from '@/types/api/expenses';

import { EditRateModal, OdometerCard, RateCard } from '../components/OdometerParts';
import { PhotoModal } from '../components/ReviewParts';
import { ReviewFrame } from '../components/ReviewFrame';
import { useOdometerReview } from '../hooks/useExpenseReview';
import { readingAmount } from '../utils/odometerMath';
import { filterByDate } from '../utils/recordFilter';

export default function OdometerScreen() {
  const r = useOdometerReview();
  const [date, setDate] = useState('');
  const [photos, setPhotos] = useState<OdometerReading | null>(null);
  const [editing, setEditing] = useState(false);

  const filtered = useMemo(() => filterByDate(r.items, date), [r.items, date]);
  const q = r.readings;

  return (
    <ReviewFrame
      title="Odometer Allowance"
      testID="odometer-screen"
      header={<RateCard rate={r.ratePerKm} onEdit={() => setEditing(true)} />}
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
      empty={{ icon: 'car', title: 'No Readings Found', message: 'Odometer readings will appear here once employees submit them' }}
      modals={
        <>
          <PhotoModal
            visible={photos !== null}
            onClose={() => setPhotos(null)}
            title="Odometer Photos"
            photos={[
              { label: 'Start Reading', uri: photos?.startPhotoUrl },
              { label: 'Stop Reading', uri: photos?.stopPhotoUrl },
            ]}
            summary={{
              name: photos?.userName || 'Unknown User',
              line: photos ? formatDate(photos.date) : '',
              amount: photos ? formatINR(readingAmount(photos, r.ratePerKm), { decimals: 2 }) : '',
            }}
          />
          {editing ? (
            <EditRateModal
              visible
              initial={r.ratePerKm}
              saving={r.savingRate}
              onClose={() => setEditing(false)}
              onSave={async (rate) => (await r.saveRate(rate)) !== undefined}
            />
          ) : null}
        </>
      }
    >
      {filtered.map((reading) => (
        <OdometerCard
          key={reading.readingId || reading.id}
          reading={reading}
          rate={r.ratePerKm}
          busy={r.busy}
          onPhotos={() => setPhotos(reading)}
          onDecide={(status) => void r.decide(reading, status, formatINR(readingAmount(reading, r.ratePerKm), { decimals: 2 }))}
        />
      ))}
    </ReviewFrame>
  );
}
