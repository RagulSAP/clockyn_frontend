import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

const mockSuggest = jest.fn();
jest.mock('@/api', () => ({
  systemApi: { submitFeatureSuggestion: (...a: unknown[]) => mockSuggest(...a) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockSuggest.mockResolvedValue(undefined);
});

describe('SuggestFeatureScreen', () => {
  it('renders the hero, the form and the character counter', async () => {
    await renderScreen(<SuggestFeatureScreen />);
    expect(screen.getByText('Suggest a Feature')).toBeTruthy();
    expect(screen.getByText('Share Your Idea')).toBeTruthy();
    expect(screen.getByText('Help us build a better Clockyn. Your feedback shapes our roadmap.')).toBeTruthy();
    expect(screen.getByText('Send Suggestion')).toBeTruthy();
    expect(screen.getByText('0/1000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('suggest-message'), 'abc');
    expect(screen.getByText('3/1000')).toBeTruthy();
  });

  it('validates subject then message and sends nothing', async () => {
    await renderScreen(<SuggestFeatureScreen />);
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Please enter a subject')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('suggest-subject'), 'Dark mode');
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Please enter your message')).toBeTruthy();
    expect(mockSuggest).not.toHaveBeenCalled();
  });

  it('sends the trimmed text with the company and e-mail, then confirms', async () => {
    await renderScreen(<SuggestFeatureScreen />);
    await fireEvent.changeText(screen.getByTestId('suggest-subject'), '  Dark mode ');
    await fireEvent.changeText(screen.getByTestId('suggest-message'), ' Please add it ');
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Thank you! Your suggestion has been sent.')).toBeTruthy();
    expect(mockSuggest).toHaveBeenCalledWith({ orgId: 'org-1', subject: 'Dark mode', content: 'Please add it', companyName: 'Acme Traders', userEmail: 'owner@example.com' });
  });

  it('enforces the 120 / 1000 character limits and returns to the previous screen ~1.8 s after success', async () => {
    await renderScreen(<SuggestFeatureScreen />);
    expect(screen.getByTestId('suggest-subject').props.maxLength).toBe(120);
    expect(screen.getByTestId('suggest-message').props.maxLength).toBe(1000);
    await fireEvent.changeText(screen.getByTestId('suggest-subject'), 'Idea');
    await fireEvent.changeText(screen.getByTestId('suggest-message'), 'Details');
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Thank you! Your suggestion has been sent.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3500 });
  });

  it('the button reads "Sending..." and ignores a second press while the request is in flight', async () => {
    let release: () => void = () => undefined;
    mockSuggest.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    await renderScreen(<SuggestFeatureScreen />);
    await fireEvent.changeText(screen.getByTestId('suggest-subject'), 'Idea');
    await fireEvent.changeText(screen.getByTestId('suggest-message'), 'Details');
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Sending...')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(mockSuggest).toHaveBeenCalledTimes(1);
    release();
    expect(await screen.findByText('Thank you! Your suggestion has been sent.')).toBeTruthy();
  });

  it('a server failure keeps the text and shows the fallback error', async () => {
    mockSuggest.mockRejectedValue(new Error('Failed to send. Please try again.'));
    await renderScreen(<SuggestFeatureScreen />);
    await fireEvent.changeText(screen.getByTestId('suggest-subject'), 'Idea');
    await fireEvent.changeText(screen.getByTestId('suggest-message'), 'Details');
    await fireEvent.press(screen.getByTestId('suggest-submit'));
    expect(await screen.findByText('Failed to send. Please try again.')).toBeTruthy();
    expect(screen.getByTestId('suggest-subject').props.value).toBe('Idea');
  });
});
