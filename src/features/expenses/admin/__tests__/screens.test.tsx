import React from 'react';
import { configure, fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as expensesModule from '@/api/expenses';
import type { Expense, OdometerReading } from '@/types/api/expenses';

import { renderScreen, signInAs } from '../testing/renderScreen';
import OdometerScreen from '../screens/OdometerScreen';
import OtherBillsScreen from '../screens/OtherBillsScreen';
import TravelTicketsScreen from '../screens/TravelTicketsScreen';

configure({ asyncUtilTimeout: 5000 });

const mockConfirm = jest.fn(async () => true);

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(cb, []);
  },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('@/api/expenses');
jest.mock('@/components/ui', () => ({ ...jest.requireActual('@/components/ui'), useConfirm: () => mockConfirm }));

const api = expensesModule as jest.Mocked<typeof expensesModule>;

const reading = (over: Partial<OdometerReading> = {}): OdometerReading => ({
  id: '1',
  readingId: 'r1',
  userName: 'Asha Verma',
  date: '2025-01-05',
  startKm: 100,
  stopKm: 150,
  status: 'pending',
  raw: {},
  ...over,
});
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: '1',
  expenseId: 'e1',
  userName: 'Ravi Kumar',
  date: '2025-01-05',
  type: 'travel',
  amount: 1500,
  status: 'pending',
  raw: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  signInAs(1);
  api.listOdometerReadings.mockResolvedValue([reading(), reading({ id: '2', readingId: 'r2', userName: 'Meera Iyer', date: '2025-01-06', status: 'approved', startKm: undefined, stopKm: undefined, distanceKm: 12.5 })]);
  api.getAllowanceRate.mockResolvedValue(3);
  api.reviewOdometerReading.mockResolvedValue({ message: 'ok' });
  api.setAllowanceRate.mockResolvedValue({ message: 'ok' });
  api.listExpenses.mockResolvedValue([expense()]);
  api.reviewExpense.mockResolvedValue({ message: 'ok' });
});

describe('OdometerScreen', () => {
  it('shows the rate, derived amounts and the record counter', async () => {
    await renderScreen(<OdometerScreen />);
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.getByTestId('odometer-rate').props.children).toBe('₹3');
    expect(screen.getByTestId('odometer-r1-amount').props.children).toBe('₹150.00');
    expect(screen.getByTestId('odometer-r2-amount').props.children).toBe('₹37.50');
    expect(screen.getByTestId('odometer-screen-count').props.children).toBe('2 of 2 records');
  });

  it('approves only after confirmation, with org_id, and decided cards lose the buttons', async () => {
    await renderScreen(<OdometerScreen />);
    await fireEvent.press(await screen.findByTestId('odometer-r1-approve'));
    await waitFor(() => expect(api.reviewOdometerReading).toHaveBeenCalledWith('r1', 'approved', 'org1'));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: 'Approve' }));
    expect(screen.queryByTestId('odometer-r2-approve')).toBeNull();
  });

  it('cancelling the confirmation sends nothing', async () => {
    mockConfirm.mockResolvedValue(false);
    await renderScreen(<OdometerScreen />);
    await fireEvent.press(await screen.findByTestId('odometer-r1-reject'));
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(api.reviewOdometerReading).not.toHaveBeenCalled();
  });

  it('saves the rate as a whole number and rejects invalid input', async () => {
    await renderScreen(<OdometerScreen />);
    await fireEvent.press(await screen.findByTestId('odometer-edit-rate'));
    await fireEvent.changeText(await screen.findByTestId('odometer-rate-input'), 'abc');
    await fireEvent.press(screen.getByTestId('odometer-save-rate'));
    expect(await screen.findByText('Please enter a valid rate')).toBeTruthy();
    expect(api.setAllowanceRate).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('odometer-rate-input'), '3.6');
    await fireEvent.press(screen.getByTestId('odometer-save-rate'));
    await waitFor(() => expect(api.setAllowanceRate).toHaveBeenCalledWith('org1', 4));
  });

  it('shows an error state with retry when loading fails', async () => {
    api.listOdometerReadings.mockRejectedValue(new Error('boom'));
    await renderScreen(<OdometerScreen />);
    expect(await screen.findByText('boom')).toBeTruthy();
  });
});

describe('TravelTicketsScreen / OtherBillsScreen', () => {
  it('lists travel tickets of the TRAVEL type and approves one', async () => {
    await renderScreen(<TravelTicketsScreen />);
    expect(await screen.findByText('Ravi Kumar')).toBeTruthy();
    expect(api.listExpenses).toHaveBeenCalledWith('org1', 'travel');
    expect(screen.getByText('₹1,500.00')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('expense-e1-approve'));
    await waitFor(() => expect(api.reviewExpense).toHaveBeenCalledWith('e1', 'approved', 'org1'));
  });

  it('bills use the BILL type and the Bill/Invoice label', async () => {
    api.listExpenses.mockResolvedValue([expense({ type: 'bill' })]);
    await renderScreen(<OtherBillsScreen />);
    expect(await screen.findByText('Ravi Kumar')).toBeTruthy();
    expect(api.listExpenses).toHaveBeenCalledWith('org1', 'bill');
    expect(screen.getByText('05 Jan 2025 • Bill/Invoice')).toBeTruthy();
    expect(screen.getByText('Bill Amount')).toBeTruthy();
  });

  it('shows the empty state', async () => {
    api.listExpenses.mockResolvedValue([]);
    await renderScreen(<TravelTicketsScreen />);
    expect(await screen.findByText('No Tickets Found')).toBeTruthy();
  });
});
