/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { attendanceApi, authApi, companyApi, employeeApi, faceApi, requestsApi, shiftsApi, staffApi } from '@/api';
import { getPermissionDetail, requestPermission } from '@/lib/platform/permissions';
import { getCurrentPosition } from '@/lib/platform/location';

import EmployeeHomeScreen from '../screens/EmployeeHomeScreen';
import { renderScreen, routerPush, signInAs, staffSession, mockOf as m } from './harness';
import { resetShownBirthdays } from '../hooks/useTodayBirthdays';
import { queryKeys } from '@/lib/query/queryKeys';

jest.mock('expo-router', () => require('./harness').routerMock());
jest.mock('@/components/layout', () => require('./harness').layoutMock());

jest.mock('@/api', () => ({
  attendanceApi: { getToday: jest.fn() },
  authApi: { getOrgLogoUrl: jest.fn() },
  companyApi: { getCompanyDetails: jest.fn() },
  employeeApi: { getPersonalDetails: jest.fn(), getTodayBirthdays: jest.fn() },
  faceApi: { isFaceRegistered: jest.fn(), checkPunchLocation: jest.fn(), punch: jest.fn(), registerFace: jest.fn(), saveProfilePhoto: jest.fn() },
  requestsApi: { listEmployeeRequests: jest.fn(), getRequestCalendar: jest.fn() },
  shiftsApi: { getShift: jest.fn() },
  staffApi: { getStaff: jest.fn() },
}));
jest.mock('@/api/plans', () => ({ getOrgPlanStatus: jest.fn(async () => ({ plan_id: 3, is_free_trial: false, is_expired: false })) }));
jest.mock('@/lib/platform/permissions', () => ({
  getPermissionDetail: jest.fn(),
  requestPermission: jest.fn(),
  openAppSettings: jest.fn(),
}));
jest.mock('@/lib/platform/location', () => ({
  getCurrentPosition: jest.fn(),
  startForegroundTracking: jest.fn(async () => true),
  startBackgroundTracking: jest.fn(async () => false),
  stopAllTracking: jest.fn(async () => undefined),
}));
jest.mock('@/components/overlays', () => ({
  PermissionOnboarding: () => null,
  RateAppModal: () => null,
  usePermissionOnboarding: () => ({ visible: false, complete: jest.fn() }),
  useRatePrompt: () => ({ visible: false, close: jest.fn() }),
}));
jest.mock('expo-camera', () => {
  const R = require('react') as typeof React;
  const { View } = require('react-native');
  const CameraView = R.forwardRef(function CameraView(props: { onCameraReady?: () => void }, ref: React.Ref<unknown>) {
    R.useImperativeHandle(ref, () => ({ takePictureAsync: async () => ({ uri: 'file:///face.jpg' }) }));
    R.useEffect(() => {
      props.onCameraReady?.();
    }, []);
    return <View testID="camera-view" />;
  });
  return { CameraView, useCameraPermissions: () => [{ granted: true, canAskAgain: true, status: 'granted' }, jest.fn(async () => ({ granted: true }))] };
});

const granted = { status: 'granted', canAskAgain: true };

function arrange(over: { face?: boolean; today?: object; permission?: object; position?: 'ok' | 'fail'; outside?: boolean; maxSessions?: number } = {}) {
  m(authApi.getOrgLogoUrl).mockResolvedValue(null);
  m(companyApi.getCompanyDetails).mockResolvedValue({ maxSessionsPerDay: over.maxSessions });
  m(faceApi.isFaceRegistered).mockResolvedValue(over.face ?? true);
  m(staffApi.getStaff).mockResolvedValue({ name: 'Asha Rao', shiftId: 4, isFieldStaff: false });
  m(shiftsApi.getShift).mockResolvedValue({ id: 4, name: 'General', startTime: '09:00', endTime: '18:00' });
  m(attendanceApi.getToday).mockResolvedValue({ isPunchedIn: false, sessions: [], punchCount: 0, totalWorkHours: 0, ...over.today });
  m(requestsApi.listEmployeeRequests).mockResolvedValue([
    { type: 'shift_change', status: 'pending', dates: [], dateStatuses: {}, raw: { status: 'pending' } },
    { type: 'device_change', status: 'approved', dates: [], dateStatuses: {}, raw: { status: 'approved' } },
  ]);
  m(employeeApi.getPersonalDetails).mockResolvedValue({ name: 'Asha Rao' });
  m(employeeApi.getTodayBirthdays).mockResolvedValue([]);
  m(getPermissionDetail).mockResolvedValue(over.permission ?? granted);
  m(requestPermission).mockResolvedValue(true);
  m(getCurrentPosition).mockImplementation(async () => {
    if (over.position === 'fail') throw new Error('no fix');
    return { latitude: 12.9, longitude: 77.6 };
  });
  m(faceApi.checkPunchLocation).mockResolvedValue(over.outside ? { allowed: false, message: 'You are 250m away from your branch.' } : { allowed: true, message: '' });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetShownBirthdays();
  signInAs(staffSession);
});

describe('EmployeeHomeScreen', () => {
  it('shows company, greeting, status, shift, time cards, the punch button and the request badge', async () => {
    arrange();
    await renderScreen(<EmployeeHomeScreen />);

    expect(screen.getByTestId('home-company').props.children).toBe('Acme Corp');
    expect(await screen.findByText('General')).toBeTruthy();
    expect(screen.getByTestId('home-status-chip')).toBeTruthy();
    expect(screen.getByText('NOT IN')).toBeTruthy();
    expect(screen.getByText('PUNCH IN')).toBeTruthy();
    expect(screen.getByText('Not Punched In')).toBeTruthy();
    expect(screen.getByTestId('time-value-in').props.children).toBe('--:--');
    expect(screen.getByTestId('remain-title').props.children).toBe('SHIFT DURATION');
    expect(screen.getByTestId('remain-clock').props.children).toBe('09:00');
    expect(screen.getByText('09:00 AM – 06:00 PM')).toBeTruthy();
    expect(await screen.findByTestId('quick-requests-badge')).toBeTruthy();
    expect(screen.getByText('Quick Actions')).toBeTruthy();
  });

  it('shows punch times and the worked-hours card once punched in', async () => {
    arrange({ today: { isPunchedIn: true, punchIn: '09:00', sessions: [{ punchIn: '09:00' }], punchCount: 1 } });
    await renderScreen(<EmployeeHomeScreen />);
    expect(await screen.findByText('PUNCH OUT')).toBeTruthy();
    expect(screen.getByText('WORKING')).toBeTruthy();
    expect(screen.getByTestId('time-value-in').props.children).toBe('09:00 AM');
    expect(screen.getByText('Checked in')).toBeTruthy();
  });

  it('locks the button with LIMIT REACHED after three completed sessions (the default limit)', async () => {
    arrange({ today: { isPunchedIn: false, punchIn: '09:00', punchOut: '18:00', sessions: [{ punchIn: '09:00', punchOut: '11:00' }, { punchIn: '12:00', punchOut: '14:00' }, { punchIn: '15:00', punchOut: '18:00' }], punchCount: 3 } });
    await renderScreen(<EmployeeHomeScreen />);
    expect(await screen.findByText('LIMIT REACHED')).toBeTruthy();
    expect(screen.getByText('COMPLETE')).toBeTruthy();
    expect(screen.getByTestId('punch-button').props.accessibilityState.disabled).toBe(true);
  });

  it("uses the organisation's configured session limit from the company settings", async () => {
    arrange({ maxSessions: 2, today: { isPunchedIn: false, punchIn: '09:00', punchOut: '18:00', sessions: [{ punchIn: '09:00', punchOut: '13:00' }, { punchIn: '14:00', punchOut: '18:00' }], punchCount: 2 } });
    await renderScreen(<EmployeeHomeScreen />);
    expect(await screen.findByText('LIMIT REACHED')).toBeTruthy();
  });

  it('asks to set up the face when none is registered and opens the registration camera', async () => {
    arrange({ face: false });
    await renderScreen(<EmployeeHomeScreen />);
    expect(await screen.findByText('SETUP FACE')).toBeTruthy();
    expect(screen.getByText('SETUP')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('punch-button'));
    expect(await screen.findByTestId('face-registration-modal')).toBeTruthy();
    expect(faceApi.checkPunchLocation).not.toHaveBeenCalled();
  });

  it('runs permission -> GPS -> geofence and then opens the face camera for PUNCH IN', async () => {
    arrange();
    await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    await fireEvent.press(screen.getByTestId('punch-button'));
    expect(await screen.findByTestId('face-recognition-modal')).toBeTruthy();
    expect(faceApi.checkPunchLocation).toHaveBeenCalledWith({ userId: 'u1', latitude: 12.9, longitude: 77.6 });
  });

  it('tells the user when they are outside the branch area and does not open the camera', async () => {
    arrange({ outside: true });
    await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    await fireEvent.press(screen.getByTestId('punch-button'));
    expect(await screen.findByText('Outside Branch Area')).toBeTruthy();
    expect(screen.getByText('You are 250m away from your branch.')).toBeTruthy();
    expect(screen.queryByTestId('face-recognition-modal')).toBeNull();
  });

  it('reports a failing geofence request instead of swallowing it', async () => {
    arrange();
    m(faceApi.checkPunchLocation).mockRejectedValue(new Error('Network connection failed.'));
    await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    await fireEvent.press(screen.getByTestId('punch-button'));
    expect(await screen.findByText('Network connection failed.')).toBeTruthy();
    expect(screen.queryByTestId('face-recognition-modal')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('punch-label').props.children).toBe('PUNCH IN'));
  });

  it('explains a missing GPS fix with the permission on', async () => {
    arrange({ position: 'fail' });
    await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    await fireEvent.press(screen.getByTestId('punch-button'));
    expect(await screen.findByText('Location Error')).toBeTruthy();
    expect(screen.getByText('Unable to get your location. Please check your GPS signal and try again.')).toBeTruthy();
  });

  it('opens the attendance calendar from the quick actions', async () => {
    arrange();
    await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    await fireEvent.press(screen.getByTestId('quick-attendance'));
    expect(routerPush).toHaveBeenCalledWith('/staff/attendance');
  });

  it('lists a birthday popup once per day', async () => {
    arrange();
    m(employeeApi.getTodayBirthdays).mockResolvedValue(['Ravi']);
    await renderScreen(<EmployeeHomeScreen />);
    expect(await screen.findByText("Today is Ravi's birthday. Wish them a wonderful birthday!")).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('birthday-close'));
    });
    await waitFor(() => expect(screen.queryByTestId('birthday-line')).toBeNull());
  });
  it('a punch refreshes today and marks the attendance calendar caches stale', async () => {
    arrange();
    m(faceApi.punch).mockResolvedValue({ success: true, message: '', faceMismatch: false, isHoliday: false, time: '09:02', raw: {} });
    const { client } = await renderScreen(<EmployeeHomeScreen />);
    await screen.findByText('PUNCH IN');
    client.setQueryData(queryKeys.attendance.month('u1', 2026, 10), []);
    client.setQueryData(queryKeys.attendance.sessions('u1', '2026-10-18'), []);
    const callsBefore = m(attendanceApi.getToday).mock.calls.length;
    await fireEvent.press(screen.getByTestId('punch-button'));
    await screen.findByTestId('face-recognition-modal');
    await waitFor(() => expect(screen.getByTestId('face-capture').props.accessibilityState.disabled).toBe(false));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('face-capture'));
    });
    expect(await screen.findByText('Punched In!')).toBeTruthy();
    await waitFor(() => expect(m(attendanceApi.getToday).mock.calls.length).toBeGreaterThan(callsBefore));
    expect(client.getQueryState(queryKeys.attendance.month('u1', 2026, 10))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.attendance.sessions('u1', '2026-10-18'))?.isInvalidated).toBe(true);
  });
});
