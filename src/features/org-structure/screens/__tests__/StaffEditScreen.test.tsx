import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { authApi, plansApi, staffApi } from '@/api';
import { routes } from '@/config/routes';
import { pickImage } from '@/lib/platform/media';
import type { StaffRecord } from '@/types/api/staff';

import StaffEditScreen from '../StaffEditScreen';
import { renderWithProviders, signInAs } from '../../testing/harness';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn(), subscribePushEvents: jest.fn(), showLocalNotification: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: () => undefined,
}));
jest.mock('@/api', () => ({
  staffApi: {
    getBranchOptions: jest.fn(),
    getDepartmentOptions: jest.fn(),
    getShiftOptions: jest.fn(),
    getNextEmployeeId: jest.fn(),
    isEmployeeIdAvailable: jest.fn(),
    getActiveStaffCount: jest.fn(),
    getStaff: jest.fn(),
    addStaff: jest.fn(),
    updateStaff: jest.fn(),
  },
  plansApi: { getSubscription: jest.fn() },
  authApi: { getEmployeePhotoUrl: jest.fn(), uploadEmployeePhoto: jest.fn(), getAuthMode: jest.fn() },
}));
jest.mock('@/lib/platform/media', () => {
  class MediaPermissionError extends Error {}
  return { pickImage: jest.fn(), MediaPermissionError };
});

const staff = staffApi as jest.Mocked<typeof staffApi>;
const plans = plansApi as jest.Mocked<typeof plansApi>;
const auth = authApi as jest.Mocked<typeof authApi>;

function setupAdd(opts: { limit?: number; current?: number } = {}) {
  staff.getBranchOptions.mockResolvedValue([{ id: 'b1', name: 'Head Office' }, { id: 'b2', name: 'Pune' }]);
  staff.getDepartmentOptions.mockResolvedValue([{ id: 'd1', name: 'Sales' }]);
  staff.getShiftOptions.mockResolvedValue([{ id: 5, name: 'General', startTime: '09:00', endTime: '18:00', isActive: true, raw: {} }]);
  staff.getNextEmployeeId.mockResolvedValue('1042');
  staff.isEmployeeIdAvailable.mockImplementation(async (_o, _r, id) => id !== '1042');
  staff.getActiveStaffCount.mockResolvedValue(opts.current ?? 3);
  plans.getSubscription.mockResolvedValue({ raw: { staff_limit: opts.limit ?? 10 } } as never);
}

async function choose(testId: string, optionText: string) {
  await fireEvent.press(screen.getByTestId(testId));
  await fireEvent.press(await screen.findByText(optionText));
}

async function fillRequired() {
  await fireEvent.changeText(screen.getByTestId('staff-name'), 'Asha Verma');
  await fireEvent.changeText(screen.getByTestId('staff-phone'), '98765-43210x');
  await choose('staff-branch', 'Head Office');
  await choose('staff-dept', 'Sales');
  await choose('staff-gender', 'Female');
}

beforeEach(() => {
  jest.clearAllMocks();
  signInAs();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  (authApi.getAuthMode as jest.Mock).mockResolvedValue('otp');
});

describe('StaffEditScreen (add)', () => {
  it('suggests the first unused employee id and shows the staff-limit banner', async () => {
    setupAdd();
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-emp-id').props.value).toBe('1043'));
    expect(staff.getNextEmployeeId).toHaveBeenCalledWith('org-1', 1);
    expect(await screen.findByText('Staff: 3 / 10')).toBeTruthy();
    expect(screen.getByText('7 slots remaining')).toBeTruthy();
    expect(screen.getAllByText('Add Staff').length).toBe(2); // header title + submit button
  });

  it('does not overwrite an employee id the user typed while the suggestion was loading', async () => {
    setupAdd();
    let release: (id: string) => void = () => undefined;
    staff.getNextEmployeeId.mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
    staff.isEmployeeIdAvailable.mockResolvedValue(true);
    await renderWithProviders(<StaffEditScreen />);
    await fireEvent.changeText(screen.getByTestId('staff-emp-id'), 'MY-77');
    release('2000');
    await waitFor(() => expect(staff.isEmployeeIdAvailable).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('staff-emp-id').props.value).toBe('MY-77'));
  });

  it('flags every missing required field and sends nothing', async () => {
    setupAdd();
    staff.getNextEmployeeId.mockResolvedValue('');
    await renderWithProviders(<StaffEditScreen />);
    await fireEvent.changeText(screen.getByTestId('staff-emp-id'), '');
    await fireEvent.press(screen.getByTestId('staff-submit'));
    expect(await screen.findByText('Please input full name')).toBeTruthy();
    expect(screen.getByText('Please input employee ID')).toBeTruthy();
    expect(screen.getByText('Please input phone number')).toBeTruthy();
    expect(screen.getByText('Please input branch name')).toBeTruthy();
    expect(screen.getByText('Please input department name')).toBeTruthy();
    expect(screen.getByText('Please select gender')).toBeTruthy();
    expect(screen.getByText('Please fill all required fields')).toBeTruthy();
    expect(staff.addStaff).not.toHaveBeenCalled();
  });

  it('e-mail sign-in deployment: the email is required and a valid one is sent lower-cased', async () => {
    (authApi.getAuthMode as jest.Mock).mockResolvedValue('email');
    setupAdd();
    staff.addStaff.mockResolvedValue({ userId: 'new-1' } as never);
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-emp-id').props.value).toBe('1043'));
    await fillRequired();
    await waitFor(() => expect(authApi.getAuthMode).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('staff-submit'));
    expect(await screen.findByText('Please input email address')).toBeTruthy();
    expect(staff.addStaff).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('staff-email'), 'Asha.Verma@Example.com');
    await fireEvent.press(screen.getByTestId('staff-submit'));
    await waitFor(() => expect(staff.addStaff).toHaveBeenCalled());
    expect(staff.addStaff.mock.calls[0][0]).toMatchObject({ email: 'asha.verma@example.com' });
  });

  it('rejects an employee id that already exists', async () => {
    setupAdd();
    staff.isEmployeeIdAvailable.mockResolvedValue(false);
    await renderWithProviders(<StaffEditScreen />);
    await fillRequired();
    await fireEvent.changeText(screen.getByTestId('staff-emp-id'), '5');
    await fireEvent.press(screen.getByTestId('staff-submit'));
    expect(await screen.findByText('Employee ID already exists. Please use a different ID.')).toBeTruthy();
    expect(screen.getByText('Employee ID already exists')).toBeTruthy();
    expect(staff.addStaff).not.toHaveBeenCalled();
  });

  it('adds the staff member (branch / department by name, digits-only phone) and uploads a picked photo', async () => {
    setupAdd();
    staff.addStaff.mockResolvedValue({ userId: 'u-99', message: 'ok' });
    auth.uploadEmployeePhoto.mockResolvedValue(undefined);
    (pickImage as jest.Mock).mockResolvedValue({ uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileName: 'p.jpg' });
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-emp-id').props.value).toBe('1043'));
    await fillRequired();
    await fireEvent.press(screen.getByTestId('staff-photo-pick'));
    await waitFor(() => expect(screen.getByTestId('staff-photo-remove')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('staff-submit'));

    await waitFor(() => expect(staff.addStaff).toHaveBeenCalledTimes(1));
    expect(staff.addStaff).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', name: 'Asha Verma', empId: '1043', mobile: '9876543210', branchName: 'Head Office', departmentName: 'Sales', gender: 'Female', shiftId: 0, isFieldStaff: false }),
    );
    await waitFor(() => expect(auth.uploadEmployeePhoto).toHaveBeenCalledWith('u-99', { uri: 'file:///p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' }));
    expect(await screen.findByText('Staff added successfully!')).toBeTruthy();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('blocks adding when the plan limit is reached and offers the billing screen', async () => {
    setupAdd({ limit: 10, current: 10 });
    await renderWithProviders(<StaffEditScreen />);
    expect(await screen.findByText('Staff limit reached. Please upgrade your plan to add more.')).toBeTruthy();
    expect(screen.getByTestId('staff-submit').props.accessibilityState?.disabled ?? screen.getByTestId('staff-submit').props['aria-disabled']).toBeTruthy();
    await fireEvent.press(screen.getByTestId('staff-limit-upgrade'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.billing.overview);
  });

  it('sends users to Shift Settings from "+ Add Shift"', async () => {
    setupAdd();
    await renderWithProviders(<StaffEditScreen />);
    await fireEvent.press(screen.getByTestId('staff-add-shift'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.shifts);
  });
});

describe('StaffEditScreen (edit)', () => {
  const record = {
    userId: 'u-1',
    name: 'Ravi Kumar',
    empId: '77',
    mobile: '9000000001',
    email: 'ravi@example.com',
    department: 'Sales',
    branch: 'Pune',
    gender: 'Male',
    shiftId: 5,
    isFieldStaff: false,
    dob: '1990-05-01',
    isActive: true,
    raw: {},
  } as unknown as StaffRecord;

  beforeEach(() => {
    setupAdd();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ staffId: 'u-1' });
    staff.getStaff.mockResolvedValue(record);
    auth.getEmployeePhotoUrl.mockResolvedValue('https://img.example/ravi.png');
  });

  it('prefills from the server record, opens More Details and does not regenerate the id', async () => {
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-name').props.value).toBe('Ravi Kumar'));
    expect(screen.getByTestId('staff-emp-id').props.value).toBe('77');
    expect(screen.getByText('Hide More Details')).toBeTruthy();
    expect(screen.getByText('Update Staff')).toBeTruthy();
    expect(staff.getNextEmployeeId).not.toHaveBeenCalled();
    expect(screen.queryByTestId('staff-limit-banner')).toBeNull();
  });

  it('leaves without a prompt when nothing changed (the existing photo is not "dirty")', async () => {
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-name').props.value).toBe('Ravi Kumar'));
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(screen.queryByText('Unsaved Changes')).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  it('asks before discarding edits, then saves via PUT without checking id uniqueness', async () => {
    staff.updateStaff.mockResolvedValue({ userId: 'u-1', message: 'ok' });
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-name').props.value).toBe('Ravi Kumar'));
    await fireEvent.changeText(screen.getByTestId('staff-name'), 'Ravi K');
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(await screen.findByText('Unsaved Changes')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('unsaved-save'));
    await waitFor(() => expect(staff.updateStaff).toHaveBeenCalledWith('u-1', expect.objectContaining({ name: 'Ravi K', empId: '77', shiftId: 5 })));
    expect(staff.isEmployeeIdAvailable).not.toHaveBeenCalled();
    expect(await screen.findByText('Staff updated successfully!')).toBeTruthy();
  });

  it('discards the edits on Exit', async () => {
    await renderWithProviders(<StaffEditScreen />);
    await waitFor(() => expect(screen.getByTestId('staff-name').props.value).toBe('Ravi Kumar'));
    await fireEvent.changeText(screen.getByTestId('staff-name'), 'Someone Else');
    await fireEvent.press(screen.getByLabelText('Go back'));
    await fireEvent.press(await screen.findByTestId('unsaved-exit'));
    expect(staff.updateStaff).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows an error state with retry when the record cannot be loaded', async () => {
    staff.getStaff.mockRejectedValue(new Error('down'));
    await renderWithProviders(<StaffEditScreen />);
    expect((await screen.findAllByText('Failed to load staff details')).length).toBeGreaterThan(0);
    expect(staff.updateStaff).not.toHaveBeenCalled();
  });
});
