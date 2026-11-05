import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';
import { pickImage } from '@/lib/platform/media';
import { MediaPermissionError } from '@/lib/platform/media.types';
import type { SupportTicket } from '@/types/api/support';

import SuggestFeatureScreen from '../screens/SuggestFeatureScreen';
import SupportScreen from '../screens/SupportScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: () => mockBack(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

const mockSupport = { listSupportSubjects: jest.fn(), listTickets: jest.fn(), submitTicket: jest.fn(), replyToTicket: jest.fn() };
const mockSuggest = jest.fn();
jest.mock('@/api', () => ({
  supportApi: {
    listSupportSubjects: (...a: unknown[]) => mockSupport.listSupportSubjects(...a),
    listTickets: (...a: unknown[]) => mockSupport.listTickets(...a),
    submitTicket: (...a: unknown[]) => mockSupport.submitTicket(...a),
    replyToTicket: (...a: unknown[]) => mockSupport.replyToTicket(...a),
  },
  systemApi: { submitFeatureSuggestion: (...a: unknown[]) => mockSuggest(...a) },
}));

jest.mock('@/lib/platform/media', () => ({
  ...jest.requireActual('@/lib/platform/media.types'),
  pickImage: jest.fn(),
}));

const ticket = (over: Partial<SupportTicket> = {}): SupportTicket => ({
  id: '7',
  subjectId: '1',
  subject: 'Billing issue',
  message: 'I was charged twice',
  photoUrl: null,
  status: 'in_progress',
  createdAt: '2026-10-01T09:00:00Z',
  replies: [
    { text: 'We are looking into it', authorName: 'Priya', isAdmin: true, createdAt: '2026-10-02T09:00:00Z' },
    { text: 'Thanks', authorName: 'Owner', isAdmin: false, createdAt: '2026-10-02T10:00:00Z' },
  ],
  raw: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockSupport.listSupportSubjects.mockResolvedValue([{ id: '1', name: 'Billing issue' }, { id: '2', name: 'Bug report' }]);
  mockSupport.listTickets.mockResolvedValue([ticket(), ticket({ id: '8', subject: 'Old question', status: 'resolved', replies: [] })]);
  mockSupport.submitTicket.mockResolvedValue(undefined);
  mockSupport.replyToTicket.mockResolvedValue(undefined);
  mockSuggest.mockResolvedValue(undefined);
});

describe('SupportScreen', () => {
  it('shows the form and the organisation tickets with status badges and reply threads', async () => {
    await renderScreen(<SupportScreen />);
    expect(screen.getByText('Support')).toBeTruthy();
    expect(screen.getByText("We're here to help")).toBeTruthy();
    expect(screen.getByText('Select a subject')).toBeTruthy();
    expect(screen.getByText('Upload Photo')).toBeTruthy();
    expect(await screen.findByText('My Tickets')).toBeTruthy();
    expect(screen.getByTestId('ticket-status-7')).toHaveTextContent('In Progress');
    expect(screen.getByTestId('ticket-status-8')).toHaveTextContent('Resolved');
    expect(screen.getByText('We are looking into it')).toBeTruthy();
    expect(screen.getByText('Priya', { exact: false })).toBeTruthy();
    expect(screen.getByText('You', { exact: false })).toBeTruthy();
    expect(screen.getByPlaceholderText('Type a reply...')).toBeTruthy();
    expect(screen.getByPlaceholderText('Reply to reopen this ticket...')).toBeTruthy();
    expect(mockSupport.listTickets).toHaveBeenCalledWith('org-1');
  });

  it('hides "My Tickets" when there are none', async () => {
    mockSupport.listTickets.mockResolvedValue([]);
    await renderScreen(<SupportScreen />);
    await waitFor(() => expect(mockSupport.listTickets).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('My Tickets')).toBeNull());
  });

  it('validates the subject first, then the message, without calling the API', async () => {
    await renderScreen(<SupportScreen />);
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(await screen.findByText('Please select a subject')).toBeTruthy();
    expect(mockSupport.submitTicket).not.toHaveBeenCalled();
  });

  it('submits a ticket with the chosen subject name and the trimmed message', async () => {
    await renderScreen(<SupportScreen />);
    await fireEvent.press(screen.getByTestId('support-subject'));
    await fireEvent.press(await screen.findByText('Bug report'));
    await fireEvent.changeText(screen.getByTestId('support-message'), '  The app crashes  ');
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(await screen.findByText('Support request submitted!')).toBeTruthy();
    expect(mockSupport.submitTicket).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1', subject: 'Bug report', message: 'The app crashes', photo: null });
  });

  it('a successful submit clears the form and returns to the previous screen after ~1.5 s', async () => {
    await renderScreen(<SupportScreen />);
    await fireEvent.press(screen.getByTestId('support-subject'));
    await fireEvent.press(await screen.findByText('Bug report'));
    await fireEvent.changeText(screen.getByTestId('support-message'), 'Crash');
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(await screen.findByText('Support request submitted!')).toBeTruthy();
    expect(screen.getByTestId('support-message').props.value).toBe('');
    expect(screen.getByText('Select a subject')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('a failed submit shows the server detail and keeps the form; the message is validated after the subject', async () => {
    mockSupport.submitTicket.mockRejectedValue(new ApiError({ status: 400, detail: 'Invalid subject: Bug report' }));
    await renderScreen(<SupportScreen />);
    await fireEvent.press(screen.getByTestId('support-subject'));
    await fireEvent.press(await screen.findByText('Bug report'));
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(await screen.findByText('Please enter a message')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('support-message'), 'Crash');
    await fireEvent.press(screen.getByTestId('support-submit'));
    expect(await screen.findByText('Invalid subject: Bug report')).toBeTruthy();
    expect(screen.getByTestId('support-message').props.value).toBe('Crash');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('attaching a photo previews it, sends it with the ticket and can be removed; denied access explains why', async () => {
    const picked = { uri: 'file:///tmp/p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg', width: 10, height: 10 };
    (pickImage as jest.Mock).mockResolvedValueOnce(picked);
    await renderScreen(<SupportScreen />);
    await fireEvent.press(screen.getByTestId('support-photo-add'));
    expect(await screen.findByTestId('support-photo-preview')).toBeTruthy();
    expect(pickImage).toHaveBeenCalledWith(expect.objectContaining({ source: 'library', quality: 0.7 }));
    await fireEvent.press(screen.getByTestId('support-photo-remove'));
    expect(screen.queryByTestId('support-photo-preview')).toBeNull();

    (pickImage as jest.Mock).mockResolvedValueOnce(picked);
    await fireEvent.press(screen.getByTestId('support-photo-add'));
    await screen.findByTestId('support-photo-preview');
    await fireEvent.press(screen.getByTestId('support-subject'));
    await fireEvent.press(await screen.findByText('Bug report'));
    await fireEvent.changeText(screen.getByTestId('support-message'), 'With photo');
    await fireEvent.press(screen.getByTestId('support-submit'));
    await waitFor(() =>
      expect(mockSupport.submitTicket).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Bug report', message: 'With photo', photo: { uri: 'file:///tmp/p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' } }),
      ),
    );

    (pickImage as jest.Mock).mockRejectedValueOnce(new MediaPermissionError('photos'));
    await fireEvent.press(screen.getByTestId('support-photo-add'));
    expect(await screen.findByText('Please allow photo library access.')).toBeTruthy();
    expect(screen.queryByTestId('support-photo-preview')).toBeNull();
  });

  it('a legacy single reply is labelled "Admin Reply" and a blank admin author falls back to "Admin"', async () => {
    mockSupport.listTickets.mockResolvedValue([
      ticket({ id: '9', replies: [{ text: 'Old style answer', authorName: 'Admin Reply', isAdmin: true, createdAt: null }] }),
      ticket({ id: '10', replies: [{ text: 'Unnamed', authorName: '', isAdmin: true, createdAt: null }] }),
    ]);
    await renderScreen(<SupportScreen />);
    expect(await screen.findByText('Admin Reply')).toBeTruthy();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('replying posts the draft with the author name, clears it and reloads the tickets', async () => {
    await renderScreen(<SupportScreen />);
    const input = await screen.findByTestId('reply-input-7');
    expect(screen.getByTestId('reply-send-7')).toBeDisabled();
    await fireEvent.changeText(input, 'Any update?');
    expect(screen.getByTestId('reply-send-7')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('reply-send-7'));
    expect(await screen.findByText('Reply sent!')).toBeTruthy();
    expect(mockSupport.replyToTicket).toHaveBeenCalledWith('7', { text: 'Any update?', authorName: 'Owner', isAdmin: false });
    await waitFor(() => expect(mockSupport.listTickets.mock.calls.length).toBeGreaterThan(1));
    expect(screen.getByTestId('reply-input-7').props.value).toBe('');
  });

  it('a failed reply keeps the draft and shows the error', async () => {
    mockSupport.replyToTicket.mockRejectedValue(new Error('Ticket not found'));
    await renderScreen(<SupportScreen />);
    await fireEvent.changeText(await screen.findByTestId('reply-input-7'), 'Hello');
    await fireEvent.press(screen.getByTestId('reply-send-7'));
    expect(await screen.findByText('Ticket not found')).toBeTruthy();
    expect(screen.getByTestId('reply-input-7').props.value).toBe('Hello');
  });
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
