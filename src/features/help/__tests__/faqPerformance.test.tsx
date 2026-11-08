import React, { Profiler } from 'react';
import { Pressable } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { SupportFaq } from '@/types/api/support';

import { renderScreen, signInTestAdmin } from '../../settings/__tests__/testHelpers';
import { FaqRow } from '../components/FaqRow';
import FaqScreen from '../screens/FaqScreen';
import { groupByBucket, groupByCategory, limitBucketGroups, limitCategoryGroups } from '../utils/faq';
import { createFaqOpenStore } from '../utils/faqOpen';

let mockWidth = 390;
jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useNavigation: () => ({ addListener: () => () => undefined }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
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
jest.mock('@/api', () => ({ supportApi: { listFaqs: (...a: unknown[]) => mockListFaqs(...a) } }));

const make = (n: number, bucket = 'Help & Fixes', category = 'Troubleshooting'): SupportFaq[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    bucket,
    category,
    question: `Question number ${i + 1}?`,
    answer: `Answer number ${i + 1}.`,
  }));

beforeEach(() => {
  mockWidth = 390;
  signInTestAdmin();
});

describe('open store', () => {
  it('notifies only the subscribers of the toggled FAQ', () => {
    const store = createFaqOpenStore();
    const a = jest.fn();
    const b = jest.fn();
    store.subscribe('1', a);
    const offB = store.subscribe('2', b);
    store.toggle('1');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(store.isOpen('1')).toBe(true);
    store.toggle('1');
    expect(store.isOpen('1')).toBe(false);
    offB();
    store.toggle('2');
    expect(b).not.toHaveBeenCalled(); // unsubscribed
    expect(store.isOpen('2')).toBe(true);
  });
});

describe('FaqRow', () => {
  it('re-renders only the row that was toggled', async () => {
    const [one, two] = make(2);
    const store = createFaqOpenStore();
    const renders = { one: 0, two: 0 };
    await renderScreen(
      <>
        <Profiler id="one" onRender={() => void (renders.one += 1)}>
          <FaqRow faq={one} store={store} />
        </Profiler>
        <Profiler id="two" onRender={() => void (renders.two += 1)}>
          <FaqRow faq={two} store={store} />
        </Profiler>
      </>,
    );
    const before = { ...renders };
    await fireEvent.press(screen.getByTestId('faq-1'));
    expect(screen.getByTestId('faq-1').props.accessibilityState.expanded).toBe(true);
    expect(screen.getByText('Answer number 1.')).toBeTruthy();
    expect(renders.one).toBeGreaterThan(before.one);
    expect(renders.two).toBe(before.two); // the neighbour was not touched
    await fireEvent.press(screen.getByTestId('faq-1'));
    expect(screen.queryByText('Answer number 1.')).toBeNull();
    expect(renders.two).toBe(before.two);
  });

  it('keeps its open state in the store when it unmounts and mounts again (searching, switching bucket)', async () => {
    const [one] = make(1);
    const store = createFaqOpenStore();
    function Harness() {
      const [on, setOn] = React.useState(true);
      return (
        <>
          <Pressable testID="mount-toggle" onPress={() => setOn((v) => !v)} />
          {on ? <FaqRow faq={one} store={store} /> : null}
        </>
      );
    }
    await renderScreen(<Harness />);
    await fireEvent.press(screen.getByTestId('faq-1'));
    await fireEvent.press(screen.getByTestId('mount-toggle')); // unmount the row
    expect(screen.queryByTestId('faq-1')).toBeNull();
    await fireEvent.press(screen.getByTestId('mount-toggle')); // mount it again
    expect(screen.getByTestId('faq-1').props.accessibilityState.expanded).toBe(true);
    expect(screen.getByText('Answer number 1.')).toBeTruthy();
  });
});

describe('long lists are mounted in steps', () => {
  it('shows the first rows at once, then the rest; the sub-header counts all of them from the start', async () => {
    mockListFaqs.mockResolvedValue(make(130));
    await renderScreen(<FaqScreen />);
    await fireEvent.press(await screen.findByTestId('faq-bucket-help-fixes'));
    expect(screen.getByTestId('faq-1')).toBeTruthy();
    expect(screen.getByTestId('faq-24')).toBeTruthy();
    expect(screen.queryByTestId('faq-130')).toBeNull(); // not mounted in the first pass
    expect(screen.getByText('Troubleshooting · 130')).toBeTruthy(); // the real total, not the 24 mounted so far
    await waitFor(() => expect(screen.getByTestId('faq-130')).toBeTruthy());
    expect(screen.getAllByTestId(/^faq-\d+$/)).toHaveLength(130);
  });

  it('mounts a wide search in steps too, and a short list is complete at once', async () => {
    mockListFaqs.mockResolvedValue(make(100));
    await renderScreen(<FaqScreen />);
    await screen.findByTestId('faq-tiles');
    await fireEvent.changeText(screen.getByTestId('faq-search'), 'question');
    await waitFor(() => expect(screen.getByTestId('faq-result-count')).toBeTruthy());
    expect(screen.getAllByTestId(/^faq-\d+$/).length).toBeLessThan(100);
    await waitFor(() => expect(screen.getAllByTestId(/^faq-\d+$/)).toHaveLength(100));
  });

  it('a small bucket is complete on the first render', async () => {
    mockListFaqs.mockResolvedValue(make(10));
    await renderScreen(<FaqScreen />);
    await fireEvent.press(await screen.findByTestId('faq-bucket-help-fixes'));
    expect(screen.getAllByTestId(/^faq-\d+$/)).toHaveLength(10);
  });
});

describe('limiting groups', () => {
  const list = [
    ...make(3, 'A', 'A1'),
    ...make(2, 'A', 'A2').map((f) => ({ ...f, id: `b${f.id}` })),
    ...make(2, 'B', 'B1').map((f) => ({ ...f, id: `c${f.id}` })),
  ];

  it('cuts a category list at the limit, keeps the totals, and drops what is left empty', () => {
    const groups = groupByCategory(list.filter((f) => f.bucket === 'A'));
    expect(limitCategoryGroups(groups, 100)).toEqual(groups);
    const cut = limitCategoryGroups(groups, 4);
    expect(cut.map((g) => [g.category, g.items.length, g.total])).toEqual([
      ['A1', 3, 3],
      ['A2', 1, 2],
    ]);
    expect(limitCategoryGroups(groups, 3).map((g) => g.category)).toEqual(['A1']);
    expect(limitCategoryGroups(groups, 0)).toEqual([]);
  });

  it('cuts bucket groups across buckets and categories', () => {
    const groups = groupByBucket(list);
    const cut = limitBucketGroups(groups, 6);
    expect(cut.map((b) => [b.bucket, b.categories.map((c) => c.items.length)])).toEqual([
      ['A', [3, 2]],
      ['B', [1]],
    ]);
    expect(limitBucketGroups(groups, 5).map((b) => b.bucket)).toEqual(['A']);
  });
});
