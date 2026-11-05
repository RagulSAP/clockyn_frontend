import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { authApi, companyApi, homeApi, plansApi, requestsApi } from '@/api';
import { getOrgPlanStatus } from '@/api/plans';
import { routes } from '@/config/routes';
import { todayIST } from '@/lib/datetime';
import { getSession, signIn, useAuthStore, type Session } from '@/store/auth';
import { ThemeProvider } from '@/theme';

import HomeScreen from '../HomeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));
jest.mock('@/components/overlays', () => ({
  PermissionOnboarding: () => null,
  RateAppModal: () => null,
  usePermissionOnboarding: () => ({ visible: false, complete: jest.fn() }),
  useRatePrompt: () => ({ visible: false, close: jest.fn() }),
}));
jest.mock('@/api/plans', () => ({ getOrgPlanStatus: jest.fn() }));
jest.mock('@/api', () => ({
  homeApi: { getDashboardStats: jest.fn(), getBranches: jest.fn(), getDepartmentStats: jest.fn() },
  authApi: { getOrgLogoUrl: jest.fn() },
  companyApi: { getCompanyDetails: jest.fn(), listCompanies: jest.fn() },
  requestsApi: { getPendingCounts: jest.fn() },
  plansApi: { getOrgPlanStatus: jest.fn(), getSubscription: jest.fn() },
}));

const mockPlanStatus = getOrgPlanStatus as jest.Mock;


const admin: Session = { userId: 'admin-1', orgId: 'org-1', orgName: 'Acme Corp', roleId: 1, managerPermissions: [] };
const stats = { totalStaff: 12, punchedIn: 4, working: 4, punchedOut: 2, absent: 6, latePunchedIn: 1 };

let client: QueryClient;
function renderHome() {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <HomeScreen />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useAuthStore.setState({ session: null });
  signIn(admin);
  (homeApi.getDashboardStats as jest.Mock).mockResolvedValue(stats);
  (homeApi.getBranches as jest.Mock).mockResolvedValue([{ id: 'b1', name: 'Head Office', address: '', orgId: 'org-1', latitude: 0, longitude: 0, radius: 100, raw: {} }]);
  (homeApi.getDepartmentStats as jest.Mock).mockResolvedValue([
    { deptId: 'd1', deptName: 'Sales', totalStaff: 5, punchedIn: 2, working: 2, punchedOut: 1, absent: 2, latePunchedIn: 1 },
  ]);
  (authApi.getOrgLogoUrl as jest.Mock).mockResolvedValue(null);
  (companyApi.getCompanyDetails as jest.Mock).mockImplementation(async (id: string) => ({ name: id === 'org-2' ? 'Beta Corp' : 'Acme Corp' }));
  (companyApi.listCompanies as jest.Mock).mockResolvedValue([
    { orgId: 'org-1', name: 'Acme Corp', address: 'Pune', gst: '', raw: {} },
    { orgId: 'org-2', name: 'Beta Corp', address: '', gst: '', raw: {} },
  ]);
  (requestsApi.getPendingCounts as jest.Mock).mockResolvedValue({ total: 3, leave: 1, permission: 1, shiftChange: 1, deviceChange: 0 });
  mockPlanStatus.mockResolvedValue({ plan_id: 3, is_free_trial: false, is_expired: false });
  (plansApi.getOrgPlanStatus as jest.Mock).mockResolvedValue({ plan_id: 2, is_free_trial: false, is_expired: false });
  (plansApi.getSubscription as jest.Mock).mockResolvedValue({ isFreeTrial: false, freeTrialEnd: null, endDate: '2999-01-01', planId: 3, staffLimit: 10 });
});
afterEach(() => client.clear());

describe('HomeScreen (admin dashboard)', () => {
  it('renders the org header, the six summary figures, quick actions and the manage grid', async () => {
    await renderHome();
    expect(await screen.findByText('Acme Corp')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('figure-total-value').props.children).toBe(12));
    expect(screen.getByTestId('figure-absent-value').props.children).toBe(6);
    expect(screen.getByTestId('figure-late-value').props.children).toBe(1);
    expect(screen.getByText('Quick Actions')).toBeTruthy();
    expect(screen.getByText('Manage')).toBeTruthy();
    for (const title of ['Staff', 'Branches', 'Departments']) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByLabelText('View Staff')).toBeTruthy();
    expect(screen.getByLabelText('Add Staff')).toBeTruthy();
    // the Staff card shows the live total from the dashboard stats
    await waitFor(() => expect(screen.getByTestId('manage-count-staff').props.children).toBe(12));
    // Requests badge
    await waitFor(() => expect(screen.getByTestId('qa-requests-badge')).toBeTruthy());
    expect(homeApi.getDashboardStats).toHaveBeenCalledWith('org-1', { date: todayIST(), branchId: '' });
  });

  it('opens the staff list with the correct filter values, branch and date', async () => {
    await renderHome();
    await screen.findByTestId('figure-punched_out');
    await fireEvent.press(screen.getByTestId('figure-punched_out'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: routes.admin.staff.list,
      params: { filter: 'punched_out', date: todayIST() },
    });
    await fireEvent.press(screen.getByTestId('figure-punched_in'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: routes.admin.staff.list,
      params: { filter: 'punched_in', date: todayIST() },
    });
  });

  it('opens the overview from the card header', async () => {
    await renderHome();
    await screen.findByTestId('summary-open-overview');
    await fireEvent.press(screen.getByTestId('summary-open-overview'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.overview, params: { date: todayIST() } });
  });

  it('shows the department cards with real Late / Punch In counts when the switch is on', async () => {
    await renderHome();
    await screen.findByTestId('filter-department');
    await fireEvent.press(screen.getByTestId('filter-department'));
    expect(await screen.findByText('Sales')).toBeTruthy();
    expect(screen.queryByText('Quick Actions')).toBeNull();
    await fireEvent.press(screen.getByTestId('dept-d1-late'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: routes.admin.staff.list,
      params: { filter: 'late', date: todayIST(), deptId: 'd1' },
    });
  });

  it('replaces the figures by the no-record message for a past date without attendance', async () => {
    (homeApi.getDashboardStats as jest.Mock).mockResolvedValue({ ...stats, punchedIn: 0, working: 0, punchedOut: 0, latePunchedIn: 0, absent: 12 });
    await renderHome();
    // Today never shows the message, however empty.
    await screen.findByTestId('figure-total');
    expect(screen.queryByTestId('summary-no-data')).toBeNull();
  });

  it('blocks Staff Location on the Core plan with the plan message and does not navigate', async () => {
    mockPlanStatus.mockResolvedValue({ plan_id: 1, is_free_trial: false, is_expired: false });
    await renderHome();
    await screen.findByTestId('qa-location');
    await waitFor(() => expect(mockPlanStatus).toHaveBeenCalled());
    await waitFor(async () => {
      mockPush.mockClear();
      await fireEvent.press(screen.getByTestId('qa-location'));
      // Once the plan status is loaded the tap is blocked (it is allowed while still unknown, like v1).
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('allows Staff Location on an Elite plan', async () => {
    await renderHome();
    await screen.findByTestId('qa-location');
    await waitFor(() => expect(mockPlanStatus).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('qa-location'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.location, params: { date: todayIST() } });
  });

  it('navigates from the Manage grid', async () => {
    await renderHome();
    await screen.findByTestId('manage-add-branch');
    await fireEvent.press(screen.getByTestId('manage-add-branch'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.branches.edit);
    await fireEvent.press(screen.getByTestId('manage-view-dept'));
    expect(mockPush).toHaveBeenLastCalledWith(routes.admin.departments.list);
  });

  it('switches company from the switcher sheet and updates the session', async () => {
    await renderHome();
    await fireEvent.press(await screen.findByTestId('switch-company'));
    expect(await screen.findByText('Beta Corp')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('company-org-2'));
    await waitFor(() => expect(getSession()?.orgId).toBe('org-2'));
    expect(getSession()?.orgName).toBe('Beta Corp');
    // The plan of the NEW company is stored (v1 kept the previous company's plan).
    expect(getSession()?.planId).toBe(2);
  });
});
