import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { expensesApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, Icon, LoadingOverlay, Text, TextField, useToast } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { formatDate, todayIST } from '@/lib/datetime';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/query/queryKeys';
import type { PickedImage } from '@/lib/platform/media';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { DateNavigator } from '../components/DateNavigator';
import { ReadingsCard, StepIndicator } from '../components/OdometerParts';
import { PhotoCapture } from '../components/PhotoCapture';
import { SuccessModal } from '../components/SuccessModal';
import { useOdometerReadings } from '../hooks/useExpenseData';
import { odometerMode, openReading, parseOdometerKm, submitOdometerReading, validateOdometerKm, type OdometerMode } from '../utils/expenseRules';

type Outcome = { mode: OdometerMode; distance?: number };

/** Odometer: start photo + km, later stop photo + km, per selected date. The server computes the distance. */
export default function OdometerScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isDesktop } = useBreakpoint();
  const userId = useSession()?.userId ?? '';
  const today = todayIST();

  const [date, setDate] = useState(today);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [km, setKm] = useState('');
  const [kmError, setKmError] = useState<string | undefined>();
  /** Set after a submit so the form flips immediately (the refetch confirms it); cleared on date change. */
  const [modeOverride, setModeOverride] = useState<OdometerMode | null>(null);
  const [startModal, setStartModal] = useState(false);
  const [stopModal, setStopModal] = useState(false);
  const [stopDistance, setStopDistance] = useState<number | undefined>();

  const readingsQuery = useOdometerReadings(date);
  const readings = useMemo(() => readingsQuery.data ?? [], [readingsQuery.data]);
  const mode: OdometerMode = modeOverride ?? odometerMode(readings, date);

  const changeDate = (next: string) => {
    if (next === date) return;
    setDate(next);
    setPhoto(null);
    setKm('');
    setKmError(undefined);
    setModeOverride(null);
  };

  const submit = useAsyncAction(
    async (): Promise<Outcome | undefined> => {
      if (!photo || !km.trim()) {
        toast.error('Please upload image and enter KM value');
        return undefined;
      }
      const startKm = openReading(readings, date)?.startKm;
      const problem = validateOdometerKm(km, mode, startKm);
      if (problem) {
        setKmError(problem);
        toast.error(problem);
        return undefined;
      }
      setKmError(undefined);
      const value = parseOdometerKm(km) ?? 0;
      const file = { uri: photo.uri, fileName: photo.fileName, mimeType: photo.mimeType };
      // photo first, then the record (the opposite order of travel tickets / bills)
      const outcome = await submitOdometerReading<Outcome>({
        uploadPhoto: () => expensesApi.uploadOdometerPhoto({ userId, date, photoType: mode, file }),
        record: async () =>
          mode === 'start'
            ? expensesApi.startOdometer({ userId, date, startKm: value }).then(() => ({ mode }))
            : expensesApi.stopOdometer({ userId, date, stopKm: value }).then((r) => ({ mode, distance: r.distanceKm })),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(userId) });
      return outcome;
    },
    {
      errorMessage: mode === 'start' ? 'Failed to submit start reading' : 'Failed to submit stop reading',
      onSuccess: (outcome) => {
        if (!outcome) return;
        setPhoto(null);
        setKm('');
        if (outcome.mode === 'start') {
          setModeOverride('stop');
          setStartModal(true);
        } else {
          setModeOverride('start');
          setStopDistance(outcome.distance);
          setStopModal(true);
        }
      },
    },
  );

  const isStart = mode === 'start';
  const title = date === today ? "Today's Readings" : `Readings for ${formatDate(date)}`;

  const readingsColumn = (
    <View style={{ gap: spacing.lg }}>
      <DateNavigator testID="odometer-date" date={date} today={today} onChange={changeDate} disabled={submit.loading} />
      <ReadingsCard title={title} readings={readings} loading={readingsQuery.isPending} failed={readingsQuery.isError} onRetry={() => void readingsQuery.refetch()} />
    </View>
  );

  const formColumn = (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <StepIndicator mode={mode} />
      </Card>
      <Card style={{ gap: spacing.lg }} testID="odometer-form">
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name={isStart ? 'play' : 'flag'} size={20} color="primary" />
            <Text variant="title3">{isStart ? 'Starting Reading' : 'Ending Reading'}</Text>
          </View>
          <Text variant="callout" color="textSecondary">
            {isStart ? 'Capture your odometer start reading' : 'Capture your odometer stop reading'}
          </Text>
        </View>
        <PhotoCapture photo={photo} onChange={setPhoto} title="Take Photo" subtitle="Capture a clear odometer reading" disabled={submit.loading} testID="odometer-photo" />
        <TextField
          label="Odometer Reading (KM)"
          value={km}
          onChangeText={(t) => {
            setKm(t);
            if (kmError) setKmError(undefined);
          }}
          placeholder={isStart ? 'Enter start KM' : 'Enter stop KM'}
          keyboardType="decimal-pad"
          leftIcon="route"
          error={kmError}
          testID="odometer-km"
        />
      </Card>
    </View>
  );

  return (
    <Screen
      title="Odometer Reading"
      maxWidth={isDesktop ? 1040 : 720}
      testID="odometer-screen"
      refreshing={readingsQuery.isRefetching}
      onRefresh={() => void readingsQuery.refetch()}
      footer={
        <Button
          title={isStart ? 'Save Start Reading' : 'Complete Reading'}
          icon={isStart ? 'play' : 'check-circle'}
          fullWidth
          loading={submit.loading}
          disabled={submit.loading || !km.trim() || !photo}
          onPress={() => void submit.run()}
          testID="odometer-submit"
        />
      }
    >
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{readingsColumn}</View>
        <View style={{ flex: isDesktop ? 1 : undefined, alignSelf: 'stretch' }}>{formColumn}</View>
      </View>
      <LoadingOverlay visible={submit.loading} message="Loading..." />
      <SuccessModal
        visible={startModal}
        icon="check-circle"
        title="Start Recorded!"
        message="Your start reading has been saved. Don't forget to submit your stop reading at the end of the trip."
        actionLabel="Got it"
        onClose={() => setStartModal(false)}
        testID="odometer-start-modal"
      />
      <SuccessModal
        visible={stopModal}
        icon="flag"
        title="Trip Complete!"
        message="Stop reading submitted successfully."
        detail={stopDistance !== undefined ? `${formatNumber(stopDistance)} km travelled` : undefined}
        actionLabel="Done"
        onClose={() => setStopModal(false)}
        testID="odometer-stop-modal"
      />
    </Screen>
  );
}
