import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { expensesApi } from '@/api';
import { pickImage } from '@/lib/platform/media';
import type { Expense, OdometerReading } from '@/types/api/expenses';

import ExpensesHubScreen from '../screens/ExpensesHubScreen';
import OdometerScreen from '../screens/OdometerScreen';
import OtherBillsScreen from '../screens/OtherBillsScreen';
import TravelTicketsScreen from '../screens/TravelTicketsScreen';
import { PICKED_PHOTO, renderWithProviders, resetToasts, signInForTest } from '../testing/harness';
import { routerMock } from '../testing/navigationMock';

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (cb: () => void) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      React.useEffect(cb, []);
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/navigation', () => require('../testing/navigationMock'));
// 2026-10-14 (IST). Date.now itself is left alone: the test library's timeouts depend on it.
jest.mock('@/lib/datetime', () => {
  const actual = jest.requireActual('@/lib/datetime');
  const NOW = Date.UTC(2026, 9, 14, 6, 0, 0);
  return { ...actual, todayIST: () => actual.todayIST(NOW), minutesNowIST: () => actual.minutesNowIST(NOW), currentMonthIST: () => actual.currentMonthIST(NOW) };
});
jest.mock('@/lib/platform/media', () => {
  class MediaPermissionError extends Error {
    permission = 'camera' as const;
  }
  return { pickImage: jest.fn(), MediaPermissionError };
});
jest.mock('@/api', () => ({
  expensesApi: {
    getOdometerReadings: jest.fn(),
    startOdometer: jest.fn(),
    stopOdometer: jest.fn(),
    uploadOdometerPhoto: jest.fn(),
    listMyExpenses: jest.fn(),
    submitExpense: jest.fn(),
    uploadExpensePhoto: jest.fn(),
  },
}));

const api = expensesApi as jest.Mocked<typeof expensesApi>;
const pick = pickImage as jest.Mock;
const TODAY = '2026-10-14';

const expense = (id: string, amount: number): Expense => ({ id, expenseId: id, date: TODAY, type: 'travel', amount, status: 'pending', raw: {} });
const reading = (over: Partial<OdometerReading>): OdometerReading => ({ id: 'r1', readingId: 'r1', date: TODAY, status: 'pending', raw: {}, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  resetToasts();
  signInForTest();
  pick.mockResolvedValue(PICKED_PHOTO);
  api.getOdometerReadings.mockResolvedValue([]);
  api.listMyExpenses.mockResolvedValue([]);
});

describe('ExpensesHubScreen', () => {
  it('shows the three cards and the footer hint', async () => {
    await renderWithProviders(<ExpensesHubScreen />);
    expect(screen.getByText('ODO Meter Reading')).toBeTruthy();
    expect(screen.getByText('Travel Tickets')).toBeTruthy();
    expect(screen.getByText('Other Bills')).toBeTruthy();
    expect(screen.getByText('Expenses are submitted for manager approval')).toBeTruthy();
  });

  it('pre-loads today (IST) for the odometer, then opens it', async () => {
    await renderWithProviders(<ExpensesHubScreen />);
    await fireEvent.press(screen.getByTestId('expense-card-odo'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/expenses/odometer'));
    expect(api.getOdometerReadings).toHaveBeenCalledWith('u1', TODAY);
  });

  it('asks for TRAVEL / BILL lists of today and still opens when the pre-load fails', async () => {
    api.listMyExpenses.mockRejectedValue(new Error('offline'));
    await renderWithProviders(<ExpensesHubScreen />);
    await fireEvent.press(screen.getByTestId('expense-card-travel'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/expenses/travel'));
    expect(api.listMyExpenses).toHaveBeenCalledWith('u1', { type: 'travel', date: TODAY });
    await fireEvent.press(screen.getByTestId('expense-card-bills'));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/staff/expenses/bills'));
    expect(api.listMyExpenses).toHaveBeenCalledWith('u1', { type: 'bill', date: TODAY });
  });
});

describe('OdometerScreen', () => {
  it('starts empty in start mode with a disabled submit and no way past today', async () => {
    await renderWithProviders(<OdometerScreen />);
    expect(await screen.findByText('No readings yet')).toBeTruthy();
    expect(screen.getByText("Today's Readings")).toBeTruthy();
    expect(screen.getByText('Starting Reading')).toBeTruthy();
    expect(screen.getByText('Save Start Reading')).toBeTruthy();
    expect(screen.getByTestId('odometer-submit')).toBeDisabled();
    expect(screen.getByTestId('odometer-date-next')).toBeDisabled();
    expect(screen.queryByText('Add First Reading')).toBeNull();

    await fireEvent.press(screen.getByTestId('odometer-date-prev'));
    await waitFor(() => expect(api.getOdometerReadings).toHaveBeenCalledWith('u1', '2026-10-13'));
    expect(await screen.findByText('Readings for 13 Oct 2026')).toBeTruthy();
    expect(screen.getByTestId('odometer-date-next')).not.toBeDisabled();
  });

  it('uploads the start photo BEFORE recording the start reading, then flips to stop mode', async () => {
    api.uploadOdometerPhoto.mockResolvedValue(undefined);
    api.startOdometer.mockResolvedValue({ message: 'ok' });
    await renderWithProviders(<OdometerScreen />);
    await screen.findByText('No readings yet');

    await fireEvent.press(screen.getByTestId('odometer-photo-add'));
    expect(await screen.findByTestId('odometer-photo-preview')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('odometer-km'), '12000');
    await fireEvent.press(screen.getByTestId('odometer-submit'));

    await waitFor(() => expect(api.startOdometer).toHaveBeenCalledTimes(1));
    expect(api.uploadOdometerPhoto).toHaveBeenCalledWith({
      userId: 'u1',
      date: TODAY,
      photoType: 'start',
      file: { uri: PICKED_PHOTO.uri, fileName: 'photo.jpg', mimeType: 'image/jpeg' },
    });
    expect(api.startOdometer).toHaveBeenCalledWith({ userId: 'u1', date: TODAY, startKm: 12000 });
    expect(api.uploadOdometerPhoto.mock.invocationCallOrder[0]).toBeLessThan(api.startOdometer.mock.invocationCallOrder[0]);
    expect(await screen.findByText('Start Recorded!')).toBeTruthy();
    expect(screen.getByText('Ending Reading')).toBeTruthy();
    // the form was cleared
    expect(screen.queryByTestId('odometer-photo-preview')).toBeNull();
  });

  it('records nothing when the photo upload fails and shows the error', async () => {
    api.uploadOdometerPhoto.mockRejectedValue(new Error('Upload timed out'));
    await renderWithProviders(<OdometerScreen />);
    await screen.findByText('No readings yet');
    await fireEvent.press(screen.getByTestId('odometer-photo-add'));
    await screen.findByTestId('odometer-photo-preview');
    await fireEvent.changeText(screen.getByTestId('odometer-km'), '12000');
    await fireEvent.press(screen.getByTestId('odometer-submit'));
    expect(await screen.findByLabelText('error: Upload timed out')).toBeTruthy();
    expect(api.startOdometer).not.toHaveBeenCalled();
    expect(screen.getByText('Starting Reading')).toBeTruthy();
  });

  it('stop mode: rejects a stop below the start, then completes the trip and shows the server distance', async () => {
    api.getOdometerReadings.mockResolvedValue([reading({ startKm: 12000 })]);
    api.uploadOdometerPhoto.mockResolvedValue(undefined);
    api.stopOdometer.mockResolvedValue({ distanceKm: 40, message: 'ok' });
    await renderWithProviders(<OdometerScreen />);
    expect(await screen.findByText('Ending Reading')).toBeTruthy();
    expect(screen.getByText('Complete Reading')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('odometer-photo-add'));
    await screen.findByTestId('odometer-photo-preview');
    await fireEvent.changeText(screen.getByTestId('odometer-km'), '11000');
    await fireEvent.press(screen.getByTestId('odometer-submit'));
    expect(await screen.findByLabelText('error: Stop reading cannot be less than the start reading')).toBeTruthy();
    expect(api.uploadOdometerPhoto).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('odometer-km'), '12040');
    await fireEvent.press(screen.getByTestId('odometer-submit'));
    await waitFor(() => expect(api.stopOdometer).toHaveBeenCalledWith({ userId: 'u1', date: TODAY, stopKm: 12040 }));
    expect(api.uploadOdometerPhoto).toHaveBeenCalledWith(expect.objectContaining({ photoType: 'stop' }));
    expect(await screen.findByText('Trip Complete!')).toBeTruthy();
    expect(screen.getByText('40 km travelled')).toBeTruthy();
    expect(screen.getByText('Starting Reading')).toBeTruthy();
  });

  it('lists readings with distance badges and dashes for missing values', async () => {
    api.getOdometerReadings.mockResolvedValue([reading({ id: 'a', startKm: 100, stopKm: 140, distanceKm: 40 }), reading({ id: 'b', startKm: 150 })]);
    await renderWithProviders(<OdometerScreen />);
    expect(await screen.findByText('40 km')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('TravelTicketsScreen', () => {
  it('lists the day with a rounded total and raw row amounts', async () => {
    api.listMyExpenses.mockResolvedValue([expense('a', 100), expense('b', 50.5)]);
    await renderWithProviders(<TravelTicketsScreen />);
    expect(await screen.findByText('Total ₹151')).toBeTruthy();
    expect(screen.getByText('₹100')).toBeTruthy();
    expect(screen.getByText('₹50.5')).toBeTruthy();
    expect(api.listMyExpenses).toHaveBeenCalledWith('u1', { type: 'travel', date: TODAY });
  });

  it('shows the empty state for the selected date and keeps submit disabled until photo and amount exist', async () => {
    await renderWithProviders(<TravelTicketsScreen />);
    expect(await screen.findByText('No tickets yet')).toBeTruthy();
    expect(screen.getByText('Submitted tickets for 14 Oct 2026 will appear here')).toBeTruthy();
    expect(screen.getByText('Ticket Photo')).toBeTruthy();
    expect(screen.getByTestId('expense-submit')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '75');
    expect(screen.getByTestId('expense-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    expect(screen.getByTestId('expense-submit')).not.toBeDisabled();
    await fireEvent.press(screen.getByTestId('expense-photo-remove'));
    expect(screen.getByTestId('expense-submit')).toBeDisabled();
  });

  it('creates the record first, then uploads the photo with the returned id', async () => {
    api.submitExpense.mockResolvedValue({ expenseId: 'E1', message: 'ok' });
    api.uploadExpensePhoto.mockResolvedValue(undefined);
    await renderWithProviders(<TravelTicketsScreen />);
    await screen.findByText('No tickets yet');
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '75.5');
    await fireEvent.press(screen.getByTestId('expense-submit'));

    await waitFor(() => expect(api.uploadExpensePhoto).toHaveBeenCalledTimes(1));
    expect(api.submitExpense).toHaveBeenCalledWith({ userId: 'u1', date: TODAY, type: 'travel', amount: 75.5 });
    expect(api.uploadExpensePhoto).toHaveBeenCalledWith({
      userId: 'u1',
      expenseId: 'E1',
      file: { uri: PICKED_PHOTO.uri, fileName: 'photo.jpg', mimeType: 'image/jpeg' },
    });
    expect(api.submitExpense.mock.invocationCallOrder[0]).toBeLessThan(api.uploadExpensePhoto.mock.invocationCallOrder[0]);
    expect(await screen.findByText('Ticket Submitted!')).toBeTruthy();
    await fireEvent.press(screen.getByText('Done'));
  });

  it('a failed photo upload is shown (not silent) and the retry re-uploads without creating a second record', async () => {
    api.submitExpense.mockResolvedValue({ expenseId: 'E9', message: 'ok' });
    api.uploadExpensePhoto.mockRejectedValueOnce(new Error('Upload timed out')).mockResolvedValue(undefined);
    await renderWithProviders(<TravelTicketsScreen />);
    await screen.findByText('No tickets yet');
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '40');
    await fireEvent.press(screen.getByTestId('expense-submit'));

    expect(await screen.findByTestId('photo-retry-banner')).toBeTruthy();
    expect(screen.getByText('Retry photo upload')).toBeTruthy();
    expect(screen.queryByText('Ticket Submitted!')).toBeNull();

    await fireEvent.press(screen.getByTestId('expense-submit'));
    await waitFor(() => expect(api.uploadExpensePhoto).toHaveBeenCalledTimes(2));
    expect(api.submitExpense).toHaveBeenCalledTimes(1);
    expect(api.uploadExpensePhoto).toHaveBeenLastCalledWith(expect.objectContaining({ expenseId: 'E9' }));
    expect(await screen.findByText('Ticket Submitted!')).toBeTruthy();
    expect(screen.queryByTestId('photo-retry-banner')).toBeNull();
  });

  it('a failed create uploads nothing and keeps the form', async () => {
    api.submitExpense.mockRejectedValue(new Error('Failed to submit expense'));
    await renderWithProviders(<TravelTicketsScreen />);
    await screen.findByText('No tickets yet');
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '40');
    await fireEvent.press(screen.getByTestId('expense-submit'));
    expect(await screen.findByLabelText('error: Failed to submit expense')).toBeTruthy();
    expect(api.uploadExpensePhoto).not.toHaveBeenCalled();
    expect(screen.getByTestId('expense-photo-preview')).toBeTruthy();
    expect(screen.queryByTestId('photo-retry-banner')).toBeNull();
  });

  it('rejects an invalid amount before calling the server', async () => {
    await renderWithProviders(<TravelTicketsScreen />);
    await screen.findByText('No tickets yet');
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '0');
    await fireEvent.press(screen.getByTestId('expense-submit'));
    expect(await screen.findByLabelText('error: Amount must be greater than zero')).toBeTruthy();
    expect(api.submitExpense).not.toHaveBeenCalled();
  });

  it('shows the camera permission message when the camera is refused', async () => {
    const { MediaPermissionError } = jest.requireMock('@/lib/platform/media') as { MediaPermissionError: new () => Error };
    pick.mockRejectedValue(new MediaPermissionError());
    await renderWithProviders(<TravelTicketsScreen />);
    await screen.findByText('No tickets yet');
    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    expect(await screen.findByLabelText('error: Camera permission is required')).toBeTruthy();
    expect(screen.queryByTestId('expense-photo-preview')).toBeNull();
  });
});

describe('OtherBillsScreen', () => {
  it('uses the bill wording and submits type bill', async () => {
    api.submitExpense.mockResolvedValue({ expenseId: 'B1', message: 'ok' });
    api.uploadExpensePhoto.mockResolvedValue(undefined);
    await renderWithProviders(<OtherBillsScreen />);
    expect(await screen.findByText('No bills yet')).toBeTruthy();
    expect(screen.getByText('Add Bill / Invoice')).toBeTruthy();
    expect(screen.getByText('Bill Photo')).toBeTruthy();
    expect(api.listMyExpenses).toHaveBeenCalledWith('u1', { type: 'bill', date: TODAY });

    await fireEvent.press(screen.getByTestId('expense-photo-add'));
    await screen.findByTestId('expense-photo-preview');
    await fireEvent.changeText(screen.getByTestId('expense-amount'), '120');
    await fireEvent.press(screen.getByText('Submit Bill'));
    await waitFor(() => expect(api.submitExpense).toHaveBeenCalledWith({ userId: 'u1', date: TODAY, type: 'bill', amount: 120 }));
    expect(await screen.findByText('Bill Submitted!')).toBeTruthy();
  });
});
