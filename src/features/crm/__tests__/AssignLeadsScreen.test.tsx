import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as branchesApi from '@/api/branches';
import * as departmentsApi from '@/api/departments';
import * as leadsApi from '@/api/leads';
import * as staffApi from '@/api/staff';
import { routes } from '@/config/routes';
import { todayIST } from '@/lib/datetime';

import AssignLeadsScreen from '../screens/AssignLeadsScreen';
import { lead } from './fixtures';
import { renderScreen, setSession } from './harness';

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/admin/crm/leads',
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');
jest.mock('@/api/branches');
jest.mock('@/api/departments');
jest.mock('@/api/staff');

const leads = jest.mocked(leadsApi);
const staff = jest.mocked(staffApi);

const today = todayIST();
const emp = (userId: string, name: string) => ({ userId, name, empId: '', branchId: 'b1', deptId: 'd1', branch: 'Head Office', department: 'Sales' });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  setSession();
  leads.listLeads.mockResolvedValue([
    lead({ id: 'L1', requiredDate: today, effectiveDate: today, clientName: 'Acme Corp', remarks: 'Call after 4pm' }),
    lead({ id: 'L2', requiredDate: today, effectiveDate: today, clientName: 'Beta Ltd', assignedUserId: 'u9', assignedUserName: 'Ravi', workStatus: 'working' }),
    lead({ id: 'L2', requiredDate: today, effectiveDate: today, clientName: 'Beta Ltd', assignedUserId: 'u8', assignedUserName: 'Meera', workStatus: 'working' }),
    lead({ id: 'L3', requiredDate: today, effectiveDate: today, clientName: 'Done Inc', assignedUserId: 'u9', assignedUserName: 'Ravi', workStatus: 'completed' }),
  ]);
  leads.listCarryForwardRequests.mockResolvedValue([]);
  jest.mocked(branchesApi.listBranches).mockResolvedValue([{ id: 'b1', name: 'Head Office', address: '', orgId: 'org1', latitude: 0, longitude: 0, radius: 100, raw: {} }]);
  jest.mocked(departmentsApi.listDepartments).mockResolvedValue([{ id: 'd1', name: 'Sales', orgId: 'org1', raw: {} }]);
  staff.listStaffForPicker.mockResolvedValue([emp('u1', 'Asha Verma'), emp('u9', 'Ravi Nair'), emp('u1', 'Asha Verma')]);
  leads.assignLead.mockResolvedValue(undefined);
  leads.reassignLead.mockResolvedValue(undefined);
});

describe('AssignLeadsScreen', () => {
  it('lists the day\'s leads once each, completed last and locked', async () => {
    await renderScreen(<AssignLeadsScreen />);
    expect(await screen.findByText('View & Assign Leads')).toBeTruthy();
    expect(await screen.findByText('Acme Corp')).toBeTruthy();
    expect(screen.getAllByText('Beta Ltd')).toHaveLength(1);
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Assigned to: Ravi, Meera')).toBeTruthy();
    expect(screen.getAllByText('Reassign')).toHaveLength(1);
  });

  it('edits through the lead id (the required date travels with the lead, not the route)', async () => {
    await renderScreen(<AssignLeadsScreen />);
    await fireEvent.press(await screen.findByTestId('crm-edit-L1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: routes.admin.crmLeads.edit, params: { leadId: 'L1' } });
  });

  it('assigns an unassigned lead to an employee with their own branch / department, then confirms', async () => {
    await renderScreen(<AssignLeadsScreen />);
    await fireEvent.press(await screen.findByTestId('crm-assign-L1'));
    expect(await screen.findByText('Select Employee')).toBeTruthy();
    expect(screen.getByText('Assign Lead')).toBeTruthy();
    // duplicate employee rows collapse
    expect(await screen.findAllByText('Asha Verma')).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('crm-assign-employee-u1'));
    await waitFor(() => expect(leads.assignLead).toHaveBeenCalledWith({ leadId: 'L1', orgId: 'org1', userId: 'u1', branchId: 'b1', deptId: 'd1' }));
    expect(await screen.findByText('Lead Assigned!')).toBeTruthy();
    expect(leads.reassignLead).not.toHaveBeenCalled();
  });

  it('reassigns an assigned lead (PUT) and excludes the current assignee', async () => {
    await renderScreen(<AssignLeadsScreen />);
    await fireEvent.press(await screen.findByTestId('crm-assign-L2'));
    expect(await screen.findByText('Reassign Lead')).toBeTruthy();
    expect(await screen.findByText('Asha Verma')).toBeTruthy();
    expect(screen.queryByText('Ravi Nair')).toBeNull();
    await fireEvent.press(screen.getByTestId('crm-assign-employee-u1'));
    await waitFor(() => expect(leads.reassignLead).toHaveBeenCalledWith({ leadId: 'L2', userId: 'u1', branchId: 'b1', deptId: 'd1' }));
    expect(await screen.findByText('Lead Reassigned!')).toBeTruthy();
  });

  it('opens the assign view directly for a leadId param', async () => {
    mockParams = { leadId: 'L1' };
    await renderScreen(<AssignLeadsScreen />);
    expect(await screen.findByText('Select Employee')).toBeTruthy();
    expect(screen.getByText('Lead Details')).toBeTruthy();
    expect(screen.getByText('Call after 4pm')).toBeTruthy();
  });

  it('keeps a failed load visible with a retry (message from the server)', async () => {
    leads.listLeads.mockRejectedValue(new Error('Your plan has expired. Please renew your plan.'));
    await renderScreen(<AssignLeadsScreen />);
    expect(await screen.findByText('Your plan has expired. Please renew your plan.')).toBeTruthy();
  });

  it('shows the empty state when the day has no leads', async () => {
    leads.listLeads.mockResolvedValue([lead({ id: 'X', requiredDate: '2020-01-01', effectiveDate: '2020-01-01' })]);
    await renderScreen(<AssignLeadsScreen />);
    expect(await screen.findByText('No Leads')).toBeTruthy();
    expect(screen.getByText('No leads found for this date')).toBeTruthy();
  });
});
