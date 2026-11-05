import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import DevicesScreen from '../DevicesScreen';
import { renderWithProviders, signInAs } from '../../testing/harness';

jest.mock('expo-router', () => ({
  router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

describe('DevicesScreen', () => {
  beforeEach(() => signInAs());

  it('lists the four device types and answers each tap with a coming-soon toast', async () => {
    await renderWithProviders(<DevicesScreen />);
    expect(screen.getByText('Add Devices')).toBeTruthy();
    expect(screen.getByText('Add Fingerprint Device')).toBeTruthy();
    expect(screen.getByText('Add Iris Device')).toBeTruthy();
    expect(screen.getByText('Add Face Authentication Device')).toBeTruthy();
    expect(screen.getByText('Add RF Tag Device')).toBeTruthy();

    await fireEvent.press(screen.getByText('Add Fingerprint Device'));
    expect(await screen.findByText('Fingerprint device coming soon')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add RF Tag Device'));
    expect(await screen.findByText('RF Tag device coming soon')).toBeTruthy();
  });
});
