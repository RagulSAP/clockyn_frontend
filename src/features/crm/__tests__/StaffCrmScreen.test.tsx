import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as leadsApi from '@/api/leads';
import { badges } from '@/store/badges';

import StaffCrmScreen from '../screens/StaffCrmScreen';
import { readSeenIds } from '../seenLeads';
import { lead, myCfr } from './fixtures';
import { openPlan, renderScreen, setSession } from './harness';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/staff/crm',
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');
const mockPlan = jest.fn();
jest.mock('@/hooks/useOrgPlan', () => ({ useOrgPlan: () => mockPlan(), usePlanFeature: jest.fn() }));

const api = jest.mocked(leadsApi);

beforeEach(() => {
  jest.clearAllMocks();
  setSession({ userId: 'u3', roleId: 3 });
  mockPlan.mockReturnValue({ ...openPlan, audience: 'staff' });
  badges.reset();
  badges.set('crm', 2);
  api.listEmployeeLeads.mockResolvedValue([
    // assigned on an earlier day: must NOT be hidden by an "assigned today" filter
    lead({ id: 'L1', clientName: 'Acme Corp', assignedUserId: 'u3', workStatus: 'pending', assignedAt: '2026-09-01T04:00:00Z', remarks: 'Ask for Priya' }),
    lead({ id: 'L2', clientName: 'Beta Ltd', assignedUserId: 'u3', workStatus: 'completed' }),
    lead({ id: 'L3', clientName: 'Gamma LLP', assignedUserId: 'u3', workStatus: 'working' }),
  ]);
  api.listMyCarryForwardRequests.mockResolvedValue([myCfr({ id: 'r1', leadId: 'L3', description: 'Client travelling' })]);
  api.updateLeadWorkStatus.mockResolvedValue(undefined);
  api.requestCarryForward.mockResolvedValue({ requestId: 'r9' });
});

describe('StaffCrmScreen', () => {
  it('shows my leads (including earlier-assigned ones) and the pending carry-forward card', async () => {
    await renderScreen(<StaffCrmScreen />);
    expect(screen.getByText('My Leads')).toBeTruthy();
    expect(screen.getByText('Assigned to you')).toBeTruthy();
    expect(await screen.findByText('Acme Corp')).toBeTruthy();
    expect(screen.getByText('Ask for Priya')).toBeTruthy();
    expect(screen.getByText('Beta Ltd')).toBeTruthy();
    expect(screen.getByText('Carry Forward Requested')).toBeTruthy();
    expect(screen.getByText('Client travelling')).toBeTruthy();
    expect(screen.getByText('Awaiting admin approval')).toBeTruthy();
  });

  it('opening the tab marks the fetched leads as seen and clears the badge', async () => {
    await renderScreen(<StaffCrmScreen />);
    await screen.findByText('Acme Corp');
    await waitFor(() => expect(badges.get().crm).toBe(0));
    await waitFor(async () => expect((await readSeenIds('u3')).sort()).toEqual(['L1', 'L2', 'L3']));
  });

  it('filters with the status chips (no carry-forward chip)', async () => {
    await renderScreen(<StaffCrmScreen />);
    await screen.findByText('Acme Corp');
    expect(screen.queryByText('Carry Forward')).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Completed' }));
    expect(screen.queryByText('Acme Corp')).toBeNull();
    expect(screen.getByText('Beta Ltd')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Working' }));
    expect(screen.getByText('No Leads Found')).toBeTruthy();
  });

  it('updates the work status through the picker', async () => {
    await renderScreen(<StaffCrmScreen />);
    await fireEvent.press(await screen.findByTestId('crm-status-L1'));
    await fireEvent.press(await screen.findByTestId('crm-status-option-working'));
    await waitFor(() => expect(api.updateLeadWorkStatus).toHaveBeenCalledWith('L1', 'working', 'u3'));
  });

  it('Carry Forward opens the request dialog instead of updating; the reason is required', async () => {
    await renderScreen(<StaffCrmScreen />);
    await fireEvent.press(await screen.findByTestId('crm-status-L1'));
    await fireEvent.press(await screen.findByTestId('crm-status-option-carry_forward'));
    expect(await screen.findByText('Carry Forward Request')).toBeTruthy();
    expect(api.updateLeadWorkStatus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('crm-cfr-send'));
    expect(api.requestCarryForward).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('crm-cfr-reason'), '  Customer asked to postpone  ');
    await fireEvent.press(screen.getByTestId('crm-cfr-send'));
    await waitFor(() =>
      expect(api.requestCarryForward).toHaveBeenCalledWith({ leadId: 'L1', orgId: 'org1', userId: 'u3', description: 'Customer asked to postpone', forwardDate: null }),
    );
    expect(await screen.findByText('Request Sent!')).toBeTruthy();
  });

  it('Add Lead opens the sheet and validates inline (staff wording)', async () => {
    await renderScreen(<StaffCrmScreen />);
    await fireEvent.press(await screen.findByTestId('crm-add-lead'));
    expect(await screen.findByText('Add New Lead')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('crm-add-lead-save'));
    expect(await screen.findByText('Please fill all required fields.')).toBeTruthy();
    expect(api.createLead).not.toHaveBeenCalled();
  });

  it('shows the plan-blocked card for staff (no purchase action) and does not fetch', async () => {
    mockPlan.mockReturnValue({ ...openPlan, audience: 'staff', isBlocked: () => true });
    await renderScreen(<StaffCrmScreen />);
    expect(await screen.findByText('CRM Unavailable')).toBeTruthy();
    expect(screen.getByText('Your plan has expired. Please contact your admin.')).toBeTruthy();
    expect(screen.queryByText('Renew Plan')).toBeNull();
    expect(api.listEmployeeLeads).not.toHaveBeenCalled();
  });

  it('checks the plan first: no lead fetch while the plan status is still loading', async () => {
    mockPlan.mockReturnValue({ ...openPlan, audience: 'staff', isLoading: true });
    await renderScreen(<StaffCrmScreen />);
    expect(screen.getByText('My Leads')).toBeTruthy();
    expect(api.listEmployeeLeads).not.toHaveBeenCalled();
    expect(api.listMyCarryForwardRequests).not.toHaveBeenCalled();
  });

  it('shows the empty state when nothing is assigned', async () => {
    api.listEmployeeLeads.mockResolvedValue([]);
    api.listMyCarryForwardRequests.mockResolvedValue([]);
    await renderScreen(<StaffCrmScreen />);
    expect(await screen.findByText('No Leads Assigned')).toBeTruthy();
  });
});
