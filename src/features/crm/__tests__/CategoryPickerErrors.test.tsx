import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import * as leadsApi from '@/api/leads';

import { CategoryPicker } from '../components/CategoryPicker';
import { renderScreen, setSession } from './harness';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  usePathname: () => '/admin/crm/leads/edit',
  useFocusEffect: () => undefined,
}));
jest.mock('@/api/leads');

const api = jest.mocked(leadsApi);
// the first render of a file pays the module-loading cost, which can be slow when the whole suite runs in parallel
jest.setTimeout(30000);

beforeEach(() => {
  jest.clearAllMocks();
  setSession();
});

describe('CategoryPicker', () => {
  it('a failed category load shows the error with a retry (not an empty "No categories")', async () => {
    api.listLeadCategories.mockRejectedValueOnce(new Error('Categories unavailable'));
    await renderScreen(<CategoryPicker value="" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('crm-category-trigger'));
    expect(await screen.findByText('Categories unavailable')).toBeTruthy();
    expect(screen.queryByText('No categories')).toBeNull();

    api.listLeadCategories.mockResolvedValue([{ id: 'c1', name: 'Retail' }]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Retail')).toBeTruthy();
  });

  it('with no categories at all it invites adding the first one', async () => {
    api.listLeadCategories.mockResolvedValue([]);
    await renderScreen(<CategoryPicker value="" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('crm-category-trigger'));
    expect(await screen.findByText('No categories')).toBeTruthy();
  });
});
