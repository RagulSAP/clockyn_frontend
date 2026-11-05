import React from 'react';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import * as expensesModule from '@/api/expenses';
import { ToastProvider } from '@/components/ui';
import { ThemeProvider } from '@/theme';
import { useAuthStore } from '@/store/auth';
import type { Expense, OdometerReading } from '@/types/api/expenses';

import OdometerScreen from '../screens/OdometerScreen';
import OtherBillsScreen from '../screens/OtherBillsScreen';
import TravelTicketsScreen from '../screens/TravelTicketsScreen';
import { reviewFailureMessage } from '../utils/recordFilter';

configure({ asyncUtilTimeout: 5000 });
// the first render of a file pays the module-loading cost, which can be slow when the whole suite runs in parallel
jest.setTimeout(30000);

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

function renderWithToasts(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const reading: OdometerReading = { id: '1', readingId: 'r1', userName: 'Asha Verma', date: '2025-01-05', startKm: 100, stopKm: 150, status: 'pending', raw: {} };
const expense = (type: 'travel' | 'bill'): Expense => ({
  id: '1',
  expenseId: 'e1',
  userName: 'Ravi Kumar',
  date: '2025-01-05',
  type,
  amount: 1500,
  status: 'pending',
  raw: {},
});

beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue(true);
  useAuthStore.setState({ hydrated: true, session: { userId: 'u1', orgId: 'org1', orgName: 'Acme Traders', roleId: 1, managerPermissions: [] } });
  api.listOdometerReadings.mockResolvedValue([reading]);
  api.getAllowanceRate.mockResolvedValue(3);
});

describe('reviewFailureMessage (v1 fallback wording)', () => {
  it('names the action and the subject', () => {
    expect(reviewFailureMessage('reading', 'approved')).toBe('Failed to approve reading');
    expect(reviewFailureMessage('reading', 'rejected')).toBe('Failed to reject reading');
    expect(reviewFailureMessage('ticket', 'approved')).toBe('Failed to approve ticket');
    expect(reviewFailureMessage('bill', 'rejected')).toBe('Failed to reject bill');
  });
});

describe('failed approve / reject toasts', () => {
  it('odometer: the v1 fallback when the server sent no text, status stays pending', async () => {
    api.reviewOdometerReading.mockRejectedValue(new Error(''));
    await renderWithToasts(<OdometerScreen />);
    await fireEvent.press(await screen.findByTestId('odometer-r1-reject'));
    expect(await screen.findByText('Failed to reject reading')).toBeTruthy();
    expect(screen.getByTestId('odometer-r1-approve')).toBeTruthy();
  });

  it('travel ticket and bill', async () => {
    api.listExpenses.mockResolvedValue([expense('travel')]);
    api.reviewExpense.mockRejectedValue(new Error(''));
    await renderWithToasts(<TravelTicketsScreen />);
    await fireEvent.press(await screen.findByTestId('expense-e1-approve'));
    expect(await screen.findByText('Failed to approve ticket')).toBeTruthy();
  });

  it('bill', async () => {
    api.listExpenses.mockResolvedValue([expense('bill')]);
    api.reviewExpense.mockRejectedValue(new Error(''));
    await renderWithToasts(<OtherBillsScreen />);
    await fireEvent.press(await screen.findByTestId('expense-e1-reject'));
    expect(await screen.findByText('Failed to reject bill')).toBeTruthy();
  });

  it('a server message wins over the fallback', async () => {
    api.reviewOdometerReading.mockRejectedValue(new Error('Reading not found'));
    await renderWithToasts(<OdometerScreen />);
    await fireEvent.press(await screen.findByTestId('odometer-r1-approve'));
    expect(await screen.findByText('Reading not found')).toBeTruthy();
    await waitFor(() => expect(api.reviewOdometerReading).toHaveBeenCalledTimes(1));
  });
});
