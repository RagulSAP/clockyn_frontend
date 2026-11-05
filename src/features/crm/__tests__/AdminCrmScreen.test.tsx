import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import * as leadsApi from '@/api/leads';
import { routes } from '@/config/routes';
import { todayIST } from '@/lib/datetime';

import AdminCrmScreen from '../screens/AdminCrmScreen';
import { cfr, lead } from './fixtures';
import { openPlan, renderScreen, setSession } from './harness';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/admin/crm',
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');
const mockPlan = jest.fn();
jest.mock('@/hooks/useOrgPlan', () => ({ useOrgPlan: () => mockPlan(), usePlanFeature: jest.fn() }));

const api = jest.mocked(leadsApi);

beforeEach(() => {
  jest.clearAllMocks();
  setSession();
  mockPlan.mockReturnValue(openPlan);
  const today = todayIST();
  api.listLeads.mockResolvedValue([
    lead({ id: 'L1', requiredDate: today, effectiveDate: today, clientName: 'Acme Corp' }),
    lead({ id: 'L2', requiredDate: today, effectiveDate: today, clientName: 'Beta Ltd', assignedUserId: 'u2', assignedUserName: 'Ravi', workStatus: 'working' }),
    lead({ id: 'L2', requiredDate: today, effectiveDate: today, clientName: 'Beta Ltd', assignedUserId: 'u3', assignedUserName: 'Meera', workStatus: 'pending' }),
  ]);
  api.listCarryForwardRequests.mockResolvedValue([cfr({ id: 'r1', leadId: 'L2', clientName: 'Beta Ltd', employeeName: 'Ravi' })]);
});

describe('AdminCrmScreen', () => {
  it('renders the menu cards, overview counts and one row per lead', async () => {
    await renderScreen(<AdminCrmScreen />);
    expect(await screen.findByText('Enter Leads')).toBeTruthy();
    expect(screen.getByText('CRM & To-Do')).toBeTruthy();
    expect(screen.getByText('Acme Ltd')).toBeTruthy();
    expect((await screen.findAllByText('Work Status Overview')).length).toBeGreaterThan(0);
    // 2 distinct leads today (the multi-assignee lead is merged into one row)
    expect(await screen.findByText('2 leads today')).toBeTruthy();
    expect(screen.getAllByText('Beta Ltd')).toHaveLength(1);
    expect(screen.getByText('CFR Pending • Prev: Ravi')).toBeTruthy();
    expect(screen.getByText('Unassigned', { exact: true })).toBeTruthy();
  });

  it('opens the enter-lead and assign screens from the menu and jumps to assign from an unassigned pill', async () => {
    await renderScreen(<AdminCrmScreen />);
    await fireEvent.press(await screen.findByLabelText('Enter Leads'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.crmLeads.edit);
    await fireEvent.press(screen.getByLabelText('View / Assign Leads'));
    expect(mockPush).toHaveBeenCalledWith(routes.admin.crmLeads.list);
    await fireEvent.press(await screen.findByTestId('crm-assign-pill-L1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.crmLeads.list, params: { leadId: 'L1' } });
  });

  it('shows the carry-forward inbox with Approve / Reject on pending requests', async () => {
    await renderScreen(<AdminCrmScreen />);
    await fireEvent.press(await screen.findByText('Carry Forward Requests'));
    expect(await screen.findByText('Approve')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
    await fireEvent.press(screen.getByText('Reject'));
    expect(api.actOnCarryForward).toHaveBeenCalledWith('r1', 'rejected', 'u1');
  });

  it('shows the plan-blocked card and does not fetch leads', async () => {
    mockPlan.mockReturnValue({ ...openPlan, isBlocked: () => true });
    await renderScreen(<AdminCrmScreen />);
    expect(await screen.findByText('CRM Unavailable')).toBeTruthy();
    expect(api.listLeads).not.toHaveBeenCalled();
    expect(api.listCarryForwardRequests).not.toHaveBeenCalled();
    // v1: a blocked organisation sees ONLY the lock card (the menu cards live inside the unblocked branch)
    expect(screen.queryByText('Enter Leads')).toBeNull();
    expect(screen.queryByText('View / Assign Leads')).toBeNull();
  });

  it('checks the plan first: nothing is fetched (and no menu is shown) while the plan status loads', async () => {
    mockPlan.mockReturnValue({ ...openPlan, isLoading: true });
    await renderScreen(<AdminCrmScreen />);
    expect(screen.queryByText('Enter Leads')).toBeNull();
    expect(api.listLeads).not.toHaveBeenCalled();
    expect(api.listCarryForwardRequests).not.toHaveBeenCalled();
  });

  it('surfaces a load failure with a retry', async () => {
    api.listLeads.mockRejectedValue(new Error('Your plan has expired. Please renew your plan.'));
    await renderScreen(<AdminCrmScreen />);
    expect(await screen.findByText('Your plan has expired. Please renew your plan.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
