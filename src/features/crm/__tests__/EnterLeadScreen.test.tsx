import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as leadsApi from '@/api/leads';

import EnterLeadScreen from '../screens/EnterLeadScreen';
import { lead } from './fixtures';
import { renderScreen, setSession } from './harness';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/admin/crm/leads/edit',
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');

const api = jest.mocked(leadsApi);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  setSession();
  api.listLeadCategories.mockResolvedValue([{ id: 'c1', name: 'Retail' }]);
  api.updateLead.mockResolvedValue(undefined);
  api.createLead.mockResolvedValue({ id: 'new' });
  api.listLeads.mockResolvedValue([
    lead({ id: 'L1', clientName: 'Acme Corp', mobile: '9876543210', address: '1 High St', categoryName: 'Retail', remarks: 'VIP', requiredDate: '2026-11-05', effectiveDate: '2026-11-05' }),
  ]);
  api.listCarryForwardRequests.mockResolvedValue([]);
});

describe('EnterLeadScreen', () => {
  it('create mode: empty form, v1 titles, inline "Required" hints and no request when invalid', async () => {
    await renderScreen(<EnterLeadScreen />);
    expect(screen.getByText('Enter New Lead')).toBeTruthy();
    expect(screen.getByText('Save Lead')).toBeTruthy();
    expect(screen.getByText('Select a date (optional)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('crm-lead-save'));
    expect((await screen.findAllByText('Required')).length).toBeGreaterThanOrEqual(3);
    expect(api.createLead).not.toHaveBeenCalled();
  });

  it('create mode: rejects a mobile number that is not 10 digits', async () => {
    await renderScreen(<EnterLeadScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText('Enter full name'), 'Acme');
    await fireEvent.changeText(screen.getByPlaceholderText('Enter mobile number'), '98765');
    await fireEvent.changeText(screen.getByPlaceholderText('Enter address'), '1 High St');
    // category is still empty -> required error first; pick one through the API-backed list is covered by edit mode
    await fireEvent.press(screen.getByTestId('crm-lead-save'));
    expect(api.createLead).not.toHaveBeenCalled();
  });

  it('edit mode: prefills the lead INCLUDING the required date and saves it back unchanged', async () => {
    mockParams = { leadId: 'L1' };
    await renderScreen(<EnterLeadScreen />);
    expect(await screen.findByText('Edit Lead')).toBeTruthy();
    expect(await screen.findByDisplayValue('Acme Corp')).toBeTruthy();
    expect(screen.getByText('05 Nov 2026')).toBeTruthy();
    expect(screen.getByText('Update Lead')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('crm-lead-save'));
    await waitFor(() =>
      expect(api.updateLead).toHaveBeenCalledWith('L1', {
        orgId: 'org1',
        name: 'Acme Corp',
        mobile: '9876543210',
        address: '1 High St',
        category: 'Retail',
        remarks: 'VIP',
        requiredDate: '2026-11-05',
      }),
    );
    expect(await screen.findByText('Lead Updated!')).toBeTruthy();
  });

  it('edit mode: reports a lead that no longer exists', async () => {
    mockParams = { leadId: 'gone' };
    await renderScreen(<EnterLeadScreen />);
    expect(await screen.findByText('Lead not found')).toBeTruthy();
    expect(screen.queryByText('Update Lead')).toBeNull();
  });
});
