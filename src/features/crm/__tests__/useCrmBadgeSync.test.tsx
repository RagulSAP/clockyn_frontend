import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';

import * as leadsApi from '@/api/leads';
import { badges } from '@/store/badges';

import { useCrmBadgeSync } from '../hooks/useCrmBadgeSync';
import { readSeenIds, writeSeenIds } from '../seenLeads';
import { lead } from './fixtures';
import { openPlan, renderScreen, setSession } from './harness';

let mockPath = '/staff/home';
jest.mock('expo-router', () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');
const mockPlan = jest.fn();
jest.mock('@/hooks/useOrgPlan', () => ({ useOrgPlan: () => mockPlan(), usePlanFeature: jest.fn() }));

const api = jest.mocked(leadsApi);

function Probe() {
  useCrmBadgeSync();
  return null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockPath = '/staff/home';
  mockPlan.mockReturnValue(openPlan);
  badges.reset();
  api.listEmployeeLeads.mockResolvedValue([lead({ id: '1' }), lead({ id: '2' }), lead({ id: '3' })]);
  await AsyncStorage.clear();
});

describe('useCrmBadgeSync', () => {
  it('sets the CRM badge to the number of unseen leads for staff', async () => {
    setSession({ userId: 'u7', roleId: 3 });
    await writeSeenIds('u7', ['1']);
    await renderScreen(<Probe />);
    await waitFor(() => expect(badges.get().crm).toBe(2));
  });

  it('zeroes the badge and marks everything seen while the CRM tab is open', async () => {
    setSession({ userId: 'u8', roleId: 2 });
    mockPath = '/staff/crm';
    badges.set('crm', 5);
    await renderScreen(<Probe />);
    await waitFor(() => expect(badges.get().crm).toBe(0));
    await waitFor(async () => expect((await readSeenIds('u8')).sort()).toEqual(['1', '2', '3']));
  });

  it('never fetches or badges for admins', async () => {
    setSession({ userId: 'a1', roleId: 1 });
    await renderScreen(<Probe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(api.listEmployeeLeads).not.toHaveBeenCalled();
    expect(badges.get().crm).toBe(0);
  });

  it('does not fetch while the plan blocks CRM', async () => {
    setSession({ userId: 'u9', roleId: 3 });
    mockPlan.mockReturnValue({ ...openPlan, isBlocked: () => true });
    await renderScreen(<Probe />);
    await new Promise((r) => setTimeout(r, 50));
    expect(api.listEmployeeLeads).not.toHaveBeenCalled();
  });
});
