import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { toast } from '@/components/ui';

import { MONTH_NAMES, currentMonthIST, daysInMonth, makeDateStr, pythonWeekday } from '@/lib/datetime';
import type { Holiday } from '@/types/api/system';

import HolidaysScreen from '../screens/HolidaysScreen';
import { renderScreen, signInAdmin } from './testHarness';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));

const mockListHolidays = jest.fn();
const mockGetOffs = jest.fn();
const mockSetOffs = jest.fn();
const mockAddDates = jest.fn();
const mockAddOne = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/system', () => ({
  listHolidays: (...a: unknown[]) => mockListHolidays(...a),
  getWeeklyOffs: (...a: unknown[]) => mockGetOffs(...a),
  setWeeklyOffs: (...a: unknown[]) => mockSetOffs(...a),
  addHolidayDates: (...a: unknown[]) => mockAddDates(...a),
  addHoliday: (...a: unknown[]) => mockAddOne(...a),
  updateHoliday: (...a: unknown[]) => mockUpdate(...a),
  deleteHoliday: (...a: unknown[]) => mockDelete(...a),
}));
jest.mock('@/api/staff', () => ({
  getBranchOptions: jest.fn(async () => [{ id: '1', name: 'Pune' }]),
  getDepartmentOptions: jest.fn(async () => [{ id: 'd1', name: 'Sales' }]),
}));

const { year, month } = currentMonthIST();
/** Non-Sunday days of the visible month (Sunday is the default weekly off). */
const workDays = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).filter((d) => pythonWeekday(makeDateStr(year, month, d)) !== 6);
const [d1, d2, d3] = workDays;
const date = (d: number) => makeDateStr(year, month, d);
const dayLabel = (d: number) => new RegExp(`^${d} ${MONTH_NAMES[month - 1]} ${year}`);

const holiday = (id: number, name: string, d: number, extra: Partial<Holiday> = {}): Holiday => ({ id, name, date: date(d), branchName: null, deptName: null, blockAttendance: true, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  toast.clear();
  signInAdmin();
  mockListHolidays.mockResolvedValue([holiday(1, 'Founders Day', d1), holiday(2, 'Founders Day', d2)]);
  mockGetOffs.mockResolvedValue([6]);
  mockSetOffs.mockResolvedValue(undefined);
  mockAddDates.mockResolvedValue({ added: 1, failed: [] });
  mockAddOne.mockResolvedValue({ id: 9 });
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

describe('HolidaysScreen', () => {
  it('shows the month calendar and the holiday list grouped by name', async () => {
    await renderScreen(<HolidaysScreen />);
    expect(await screen.findByText('Founders Day')).toBeTruthy();
    expect(screen.getByTestId('holiday-count')).toBeTruthy();
    expect(screen.getByText('1 Holiday')).toBeTruthy();
    expect(screen.getByText('No Punch')).toBeTruthy();
    expect(screen.getByText('Sun')).toBeTruthy(); // off-day subtitle
    expect(mockListHolidays).toHaveBeenCalledWith('org1', year, month);
  });

  it('shows the empty state for a month without holidays', async () => {
    mockListHolidays.mockResolvedValue([]);
    await renderScreen(<HolidaysScreen />);
    expect(await screen.findByText('No Holidays')).toBeTruthy();
  });

  it('shows an error with retry when the month cannot be loaded (never a silent empty list)', async () => {
    mockListHolidays.mockRejectedValue(new Error('Server exploded'));
    await renderScreen(<HolidaysScreen />);
    expect(await screen.findByText('Server exploded')).toBeTruthy();
  });

  it('requires a name, then adds one holiday per picked date with the chosen scope', async () => {
    await renderScreen(<HolidaysScreen />);
    await screen.findByText('Founders Day');
    await fireEvent.press(screen.getByLabelText(dayLabel(d3)));
    expect(await screen.findByTestId('selected-dates-card')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('holiday-add'));
    expect(await screen.findByText('Please enter a holiday name')).toBeTruthy();
    expect(mockAddDates).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('holiday-name'), '  Diwali ');
    await fireEvent.press(screen.getByTestId('holiday-add'));
    await waitFor(() => expect(mockAddDates).toHaveBeenCalledTimes(1));
    expect(mockAddDates).toHaveBeenCalledWith('org1', { name: 'Diwali', branchName: null, deptName: null, blockAttendance: true }, [date(d3)]);
    expect(await screen.findByText('1 holiday(s) added successfully')).toBeTruthy();
  });

  it('reports a server rejection instead of a success toast', async () => {
    mockAddDates.mockResolvedValue({ added: 0, failed: [{ date: date(d3), message: 'Holiday already exists' }] });
    await renderScreen(<HolidaysScreen />);
    await screen.findByText('Founders Day');
    await fireEvent.press(screen.getByLabelText(dayLabel(d3)));
    await fireEvent.changeText(await screen.findByTestId('holiday-name'), 'Diwali');
    await fireEvent.press(screen.getByTestId('holiday-add'));
    expect(await screen.findByText(/Failed to add holiday: Holiday already exists/)).toBeTruthy();
    expect(screen.queryByText(/added successfully/)).toBeNull();
    // the date stays picked so the user can retry
    expect(screen.getByTestId('selected-dates-card')).toBeTruthy();
  });

  it('clears the picked dates when the month changes', async () => {
    await renderScreen(<HolidaysScreen />);
    await screen.findByText('Founders Day');
    await fireEvent.press(screen.getByLabelText(dayLabel(d3)));
    expect(await screen.findByTestId('selected-dates-card')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next month'));
    await waitFor(() => expect(screen.queryByTestId('selected-dates-card')).toBeNull());
  });

  it('ignores taps on a weekly off day', async () => {
    await renderScreen(<HolidaysScreen />);
    await screen.findByText('Founders Day');
    const sunday = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).find((d) => pythonWeekday(makeDateStr(year, month, d)) === 6) as number;
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${sunday} ${MONTH_NAMES[month - 1]} ${year}, OFF`)));
    expect(screen.queryByTestId('selected-dates-card')).toBeNull();
  });

  it('deletes every date of a holiday after confirmation and checks the responses', async () => {
    await renderScreen(<HolidaysScreen />);
    await fireEvent.press(await screen.findByTestId(/holiday-menu-/));
    await fireEvent.press(await screen.findByTestId('holiday-menu-delete'));
    expect(await screen.findByText('Delete Holiday?')).toBeTruthy();
    expect(screen.getByText(/Delete all 2 dates for "Founders Day"\?/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('2 holidays deleted')).toBeTruthy();
  });

  it('does not claim success when one delete is rejected', async () => {
    mockDelete.mockImplementation(async (_org: string, id: number) => {
      if (id === 2) throw new Error('Cannot delete');
    });
    await renderScreen(<HolidaysScreen />);
    await fireEvent.press(await screen.findByTestId(/holiday-menu-/));
    await fireEvent.press(await screen.findByTestId('holiday-menu-delete'));
    await fireEvent.press(await screen.findByText('Delete'));
    expect(await screen.findByText(/Delete: 1 of 2 succeeded/)).toBeTruthy();
    expect(screen.queryByText('2 holidays deleted')).toBeNull();
  });

  it('saves the weekly off days (empty selection allowed)', async () => {
    await renderScreen(<HolidaysScreen />);
    await fireEvent.press(await screen.findByTestId('configure-off-days'));
    expect(await screen.findByText('Off: Sun')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('Sun').slice(-1)[0]);
    expect(await screen.findByText('No off days — all days are working days')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('off-days-save'));
    await waitFor(() => expect(mockSetOffs).toHaveBeenCalledWith('org1', []));
    expect(await screen.findByText('Off days updated')).toBeTruthy();
  });
});
