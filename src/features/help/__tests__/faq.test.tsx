import React from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';
import type { SupportFaq } from '@/types/api/support';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import FaqScreen from '../screens/FaqScreen';

const mockPush = jest.fn();
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
let mockWidth = 390;
let mockBeforeRemove: ((e: { preventDefault: () => void; data?: { action?: { type?: string } } }) => void) | null = null;

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useNavigation: () => ({
    addListener: (_type: string, cb: typeof mockBeforeRemove) => {
      mockBeforeRemove = cb;
      return () => {
        mockBeforeRemove = null;
      };
    },
  }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/layout', () => ({
  ...jest.requireActual('@/components/layout'),
  useBreakpoint: () => jest.requireActual('@/hooks/useBreakpoint').getBreakpoint(mockWidth, 900),
}));

const mockListFaqs = jest.fn();
jest.mock('@/api', () => ({
  supportApi: { listFaqs: (...a: unknown[]) => mockListFaqs(...a) },
}));

const faq = (id: string, bucket: string, category: string, question: string, answer: string): SupportFaq => ({ id, bucket, category, question, answer });
const FAQS = [
  faq('1', 'Set up & Account', 'Getting Started', 'How do I log in?', 'Use your email.\nThen your password.'),
  faq('2', 'Set up & Account', 'Getting Started', 'How do I add my company?', 'Open Company setup.'),
  faq('3', 'Set up & Account', 'Staff Management', 'How do I invite staff?', 'Go to Settings > Staff and tap Add staff.'),
  faq('4', 'Attendance & Time', 'Shifts', 'How do I add a shift?', 'Open Shifts and tap Add.'),
  faq('5', 'Attendance & Time', 'Attendance & Face Punch', 'How does face punch work?', 'The app takes a selfie and checks the face.'),
  faq('6', 'Pay & Expenses', 'Payroll & Salary', 'Where is the salary sheet?', 'Payroll > Salary sheet.'),
  faq('7', 'Pay & Expenses', 'Expenses & Advances', 'How do I record a salary advance?', 'Open the advance screen and add the amount.'),
  faq('8', 'Attendance & Time', 'Shifts', 'How is overtime paid?', 'Overtime is added to the salary sheet.'),
];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockWidth = 390;
  mockBeforeRemove = null;
  signInTestAdmin();
  mockListFaqs.mockResolvedValue(FAQS);
});

const expandedOf = (id: string) => screen.getByTestId(`faq-${id}`).props.accessibilityState?.expanded;
const search = async (text: string) => fireEvent.changeText(screen.getByTestId('faq-search'), text);
const openBucket = async (slug: string) => fireEvent.press(await screen.findByTestId(`faq-bucket-${slug}`));

describe('FaqScreen landing (tiles)', () => {
  it('shows a tile per bucket with its question count and categories, in server order, and no questions yet', async () => {
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    const tiles = screen.getAllByTestId(/^faq-bucket-/).map((t) => t.props.testID);
    expect(tiles).toEqual(['faq-bucket-set-up-account', 'faq-bucket-attendance-time', 'faq-bucket-pay-expenses']);
    const first = within(screen.getByTestId('faq-bucket-set-up-account'));
    expect(first.getByText('Set up & Account')).toBeTruthy();
    expect(first.getByText('3 questions')).toBeTruthy();
    expect(first.getByText('Getting Started · Staff Management')).toBeTruthy();
    expect(within(screen.getByTestId('faq-bucket-attendance-time')).getByText('3 questions')).toBeTruthy();
    expect(screen.queryByTestId('faq-1')).toBeNull(); // no flat list of questions on the landing
    expect(screen.getByTestId('faq-search')).toBeTruthy();
    expect(screen.getByText('Still need help?')).toBeTruthy();
  });

  it('opens a bucket: header with its name and count, categories as sub-headers, collapsed rows, chips to jump', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('set-up-account');
    expect(await screen.findByTestId('faq-bucket-view')).toBeTruthy();
    expect(screen.queryByTestId('faq-tiles')).toBeNull();
    expect(screen.getByText('3 questions')).toBeTruthy(); // header subtitle
    expect(screen.getByText('Getting Started · 2')).toBeTruthy();
    expect(screen.getByText('Staff Management · 1')).toBeTruthy();
    expect(screen.queryByText('Shifts · 2')).toBeNull();
    for (const id of ['1', '2', '3']) expect(expandedOf(id)).toBe(false);
    expect(screen.queryByTestId('faq-4')).toBeNull(); // another bucket
    expect(screen.getByRole('radio', { name: 'Set up & Account, 3' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Still need help?')).toBeTruthy();
  });

  it('jumps to another bucket with the chips', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('set-up-account');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Attendance & Time, 3' }));
    expect(await screen.findByTestId('faq-4')).toBeTruthy();
    expect(screen.queryByTestId('faq-1')).toBeNull();
    expect(screen.getByText('Shifts · 2')).toBeTruthy();
  });

  it('returns to the tiles with the back arrow and with the system back (which does not leave the screen)', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('pay-expenses');
    await screen.findByTestId('faq-bucket-view');
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
    expect(screen.queryByTestId('faq-bucket-view')).toBeNull();

    await openBucket('pay-expenses');
    await screen.findByTestId('faq-bucket-view');
    const preventDefault = jest.fn();
    await act(async () => mockBeforeRemove?.({ preventDefault, data: { action: { type: 'GO_BACK' } } }));
    expect(preventDefault).toHaveBeenCalled();
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
    // on the tiles there is nothing to intercept any more: back leaves the screen
    expect(mockBeforeRemove).toBeNull();
  });

  it('does not block a sign-out or any other replace while a bucket is open', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('pay-expenses');
    await screen.findByTestId('faq-bucket-view');
    const preventDefault = jest.fn();
    await act(async () => mockBeforeRemove?.({ preventDefault, data: { action: { type: 'REPLACE' } } }));
    expect(preventDefault).not.toHaveBeenCalled();
    expect(screen.getByTestId('faq-bucket-view')).toBeTruthy();
  });
});

describe('FaqScreen expandable rows', () => {
  it('opens the answer under a question and closes it on the second press', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('attendance-time');
    await fireEvent.press(await screen.findByTestId('faq-4'));
    expect(await screen.findByText('Open Shifts and tap Add.')).toBeTruthy();
    expect(expandedOf('4')).toBe(true);
    expect(screen.getByTestId('faq-4').props.accessibilityRole).toBe('button');
    await fireEvent.press(screen.getByTestId('faq-4'));
    expect(expandedOf('4')).toBe(false);
    await waitFor(() => expect(screen.queryByText('Open Shifts and tap Add.')).toBeNull());
  });

  it('keeps several answers open at once (no auto-collapse)', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('set-up-account');
    await fireEvent.press(await screen.findByTestId('faq-1'));
    await fireEvent.press(screen.getByTestId('faq-3'));
    expect(await screen.findByTestId('faq-1-answer')).toBeTruthy();
    expect(await screen.findByTestId('faq-3-answer')).toBeTruthy();
    expect(expandedOf('1')).toBe(true);
    expect(expandedOf('3')).toBe(true);
    expect(expandedOf('2')).toBe(false);
    await fireEvent.press(screen.getByTestId('faq-1')); // closing one leaves the other alone
    expect(expandedOf('1')).toBe(false);
    expect(expandedOf('3')).toBe(true);
    expect(screen.getByTestId('faq-3-answer')).toBeTruthy();
  });

  it('keeps the line breaks of an answer and makes it selectable', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('set-up-account');
    await fireEvent.press(await screen.findByTestId('faq-1'));
    const answer = await screen.findByTestId('faq-1-answer');
    expect(answer.props.children).toBe('Use your email.\nThen your password.');
    expect(answer.props.selectable).toBe(true);
  });

  it('remembers which rows are open when leaving a bucket and coming back', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('attendance-time');
    await fireEvent.press(await screen.findByTestId('faq-4'));
    await screen.findByTestId('faq-4-answer');
    await fireEvent.press(screen.getByLabelText('Go back'));
    await openBucket('attendance-time');
    expect(expandedOf('4')).toBe(true);
    expect(await screen.findByTestId('faq-4-answer')).toBeTruthy();
  });
});

describe('FaqScreen search', () => {
  it('searches ALL buckets, case-insensitively, ranks question matches first and shows "N results"', async () => {
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    await search('SALARY');
    expect(await screen.findByTestId('faq-results')).toBeTruthy();
    expect(screen.getByTestId('faq-result-count')).toHaveTextContent('3 results');
    expect(screen.queryByTestId('faq-tiles')).toBeNull();
    // 6 and 7 have it in the question, 8 only in the answer
    expect(screen.getAllByTestId(/^faq-item-/).map((n) => n.props.testID)).toEqual(['faq-item-6', 'faq-item-7', 'faq-item-8']);
    expect(screen.queryByTestId('faq-1')).toBeNull();
  });

  it('matches the question, the answer, the category and the bucket name', async () => {
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    await search('selfie'); // answer only
    expect(await screen.findByTestId('faq-5')).toBeTruthy();
    await search('payroll'); // category
    await waitFor(() => expect(screen.queryByTestId('faq-5')).toBeNull());
    expect(screen.getByTestId('faq-6')).toBeTruthy();
    await search('attendance & time'); // bucket name (and the category with the same words)
    await waitFor(() => expect(screen.getByTestId('faq-result-count')).toHaveTextContent('3 results'));
    expect(screen.getByTestId('faq-4')).toBeTruthy();
  });

  it('needs every word, in any order', async () => {
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    await search('advance salary');
    await waitFor(() => expect(screen.getByTestId('faq-result-count')).toHaveTextContent('1 result'));
    expect(screen.getByTestId('faq-7')).toBeTruthy();
    await search('salary zebra');
    expect(await screen.findByTestId('faq-no-match')).toBeTruthy();
  });

  it('shows each result with its "bucket > category" chip and the matched words in bold', async () => {
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    await search('salary sheet');
    await screen.findByTestId('faq-results');
    expect(screen.getByTestId('faq-6-chip')).toHaveTextContent('Pay & Expenses > Payroll & Salary');
    expect(screen.getByTestId('faq-8-chip')).toHaveTextContent('Attendance & Time > Shifts');
    const bold = within(screen.getByTestId('faq-6')).getAllByTestId('faq-match');
    expect(bold.map((n) => n.props.children)).toEqual(['salary', 'sheet']);
    // the answer is highlighted once the result is opened
    await fireEvent.press(screen.getByTestId('faq-8'));
    const answer = await screen.findByTestId('faq-8-answer');
    expect(within(answer).getAllByTestId('faq-match').map((n) => n.props.children)).toEqual(['salary', 'sheet']);
  });

  it('shows matches collapsed and keeps what was open; clearing returns to the view you were in', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('attendance-time');
    await fireEvent.press(await screen.findByTestId('faq-4'));
    await screen.findByTestId('faq-4-answer');

    await search('salary');
    await screen.findByTestId('faq-results');
    expect(expandedOf('8')).toBe(false); // never auto-opened by a search
    await search('shift'); // an open row stays open inside the results
    expect(await screen.findByTestId('faq-4-answer')).toBeTruthy();

    await fireEvent.press(screen.getAllByLabelText('Clear search')[0]);
    expect(await screen.findByTestId('faq-bucket-view')).toBeTruthy(); // back in the bucket, not on the tiles
    expect(screen.getByLabelText('Go back')).toBeTruthy();
    expect(expandedOf('4')).toBe(true);
    expect(screen.queryByTestId('faq-results')).toBeNull();
  });

  it('shows a friendly empty state with Clear search, Browse topics and Ask support in Live Chat', async () => {
    await renderScreen(<FaqScreen />);
    await openBucket('pay-expenses');
    await screen.findByTestId('faq-bucket-view');
    await search('zzzz');
    expect(await screen.findByText('No answers match')).toBeTruthy();
    expect(screen.queryByTestId('faq-6')).toBeNull();
    expect(screen.getByText('Still need help?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ask support in Live Chat'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/live-chat');

    await fireEvent.press(screen.getByTestId('faq-clear-search')); // back to the view you were in
    expect(await screen.findByTestId('faq-bucket-view')).toBeTruthy();
    expect(screen.queryByText('No answers match')).toBeNull();

    await search('zzzz');
    await screen.findByText('No answers match');
    await fireEvent.press(screen.getByTestId('faq-browse-topics')); // all the way back to the topics
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
    expect(screen.queryByText('No answers match')).toBeNull();
  });
});

describe('FaqScreen deep links', () => {
  it('opens the bucket named by the `bucket` param', async () => {
    mockParams = { bucket: 'attendance-time' };
    await renderScreen(<FaqScreen />);
    expect(await screen.findByTestId('faq-bucket-view')).toBeTruthy();
    expect(screen.getByTestId('faq-4')).toBeTruthy();
    expect(screen.queryByTestId('faq-1')).toBeNull();
    expect(screen.queryByTestId('faq-tiles')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Go back')); // back to the tiles even though a link opened it
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
  });

  it('narrows the bucket to the `category` param, with a way to show the whole bucket', async () => {
    mockParams = { bucket: 'Attendance & Time', category: 'attendance & face punch' };
    await renderScreen(<FaqScreen />);
    expect(await screen.findByTestId('faq-5')).toBeTruthy();
    expect(screen.queryByTestId('faq-4')).toBeNull();
    await fireEvent.press(screen.getByTestId('faq-show-all-categories'));
    expect(await screen.findByTestId('faq-4')).toBeTruthy();
  });

  it('finds the bucket of a `category` given alone', async () => {
    mockParams = { category: 'Payroll & Salary' };
    await renderScreen(<FaqScreen />);
    expect(await screen.findByTestId('faq-6')).toBeTruthy();
    expect(screen.queryByTestId('faq-7')).toBeNull(); // only that category of the bucket
  });

  it('falls back to the tiles for an unknown bucket', async () => {
    mockParams = { bucket: 'nope' };
    await renderScreen(<FaqScreen />);
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
  });
});

describe('FaqScreen on a wide screen', () => {
  beforeEach(() => {
    mockWidth = 1280;
  });

  it('shows a bucket list with counts on the left and every question, by bucket and category, on the right', async () => {
    await renderScreen(<FaqScreen />);
    expect(await screen.findByTestId('faq-nav')).toBeTruthy();
    expect(screen.queryByTestId('faq-tiles')).toBeNull();
    const nav = within(screen.getByTestId('faq-nav'));
    expect(nav.getByText('All questions')).toBeTruthy();
    expect(within(screen.getByTestId('faq-nav-all')).getByText('8')).toBeTruthy();
    expect(within(screen.getByTestId('faq-nav-set-up-account')).getByText('3')).toBeTruthy();
    expect(screen.getByTestId('faq-nav-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('faq-all-view')).toBeTruthy();
    for (const id of ['1', '4', '6']) expect(screen.getByTestId(`faq-${id}`)).toBeTruthy(); // all of them, in one column
    expect(screen.getByText('Getting Started · 2')).toBeTruthy();
  });

  it('shows one bucket when it is picked in the list, highlighted, and All questions brings everything back', async () => {
    await renderScreen(<FaqScreen />);
    await fireEvent.press(await screen.findByTestId('faq-nav-attendance-time'));
    expect(await screen.findByTestId('faq-bucket-view')).toBeTruthy();
    expect(screen.getByTestId('faq-nav-attendance-time').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('faq-nav-all').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('faq-4')).toBeTruthy();
    expect(screen.queryByTestId('faq-1')).toBeNull();
    expect(screen.queryByTestId('faq-chips')).toBeNull(); // the list replaces the chip bar
    expect(mockBeforeRemove).toBeNull(); // not a drill-in: back leaves the screen as usual
    await fireEvent.press(screen.getByTestId('faq-nav-all'));
    expect(await screen.findByTestId('faq-1')).toBeTruthy();
  });

  it('searches everything from the right-hand side too', async () => {
    await renderScreen(<FaqScreen />);
    await fireEvent.press(await screen.findByTestId('faq-nav-attendance-time'));
    await search('salary');
    expect(await screen.findByTestId('faq-results')).toBeTruthy();
    expect(screen.getByTestId('faq-6')).toBeTruthy();
    expect(screen.getByTestId('faq-nav')).toBeTruthy();
  });
});

describe('FaqScreen states', () => {
  it('shows an empty state when there are no FAQs', async () => {
    mockListFaqs.mockResolvedValue([]);
    await renderScreen(<FaqScreen />);
    expect(await screen.findByText('No FAQs yet')).toBeTruthy();
    expect(screen.queryByTestId('faq-search')).toBeNull();
  });

  it('shows the error with a retry that loads the list again', async () => {
    mockListFaqs.mockRejectedValueOnce(new ApiError({ status: 500, detail: 'Server down' }));
    await renderScreen(<FaqScreen />);
    expect(await screen.findByText('Server down')).toBeTruthy();
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByTestId('faq-tiles')).toBeTruthy();
    expect(mockListFaqs).toHaveBeenCalledTimes(2);
  });

  it('ends with a "Still need help?" card that opens Live Chat and the Video Hub', async () => {
    await renderScreen(<FaqScreen />);
    expect(await screen.findByText('Still need help?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Chat with support'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/live-chat');
    await fireEvent.press(screen.getByText('Watch guides'));
    expect(mockPush).toHaveBeenLastCalledWith('/admin/help/videos');
  });

  it.each([2, 3])('sends role %i away: the FAQ is part of the admin-only Support tab', async (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    await renderScreen(<FaqScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/staff/home');
    expect(screen.queryByText('Still need help?')).toBeNull();
    expect(mockListFaqs).not.toHaveBeenCalled();
  });
});
