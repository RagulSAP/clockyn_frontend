import type { SupportFaq } from '@/types/api/support';

import { bucketSlug, bucketVisual, faqBuckets, findBucket, groupByBucket, groupByCategory, searchFaqs, searchWords, splitMatches } from '../utils/faq';

const f = (id: string, bucket: string, category: string, question: string, answer = 'Plain answer'): SupportFaq => ({ id, bucket, category, question, answer });

const list = [
  f('1', 'Set up & Account', 'Getting Started', 'How do I log in?', 'Use your email.\nThen your password.'),
  f('2', 'Attendance & Time', 'Shifts', 'How do I add a shift?', 'Open Shifts and tap Add.'),
  f('3', 'Set up & Account', 'Staff Management', 'How do I invite staff?', 'Settings > Add staff.'),
  f('4', 'Pay & Expenses', 'Payroll & Salary', 'Where is the salary sheet?', 'Payroll > Salary sheet'),
  f('5', 'Attendance & Time', 'Shifts', 'How is overtime paid?', 'Overtime goes on the salary sheet.'),
  f('6', 'Set up & Account', 'Getting Started', 'How do I add a salary advance?', 'Open the staff member and add the amount.'),
];
const ids = (xs: SupportFaq[]) => xs.map((x) => x.id);

describe('faq buckets', () => {
  it('lists the buckets in the order of their first FAQ, with counts and categories', () => {
    expect(faqBuckets(list)).toEqual([
      { name: 'Set up & Account', count: 3, categories: ['Getting Started', 'Staff Management'] },
      { name: 'Attendance & Time', count: 2, categories: ['Shifts'] },
      { name: 'Pay & Expenses', count: 1, categories: ['Payroll & Salary'] },
    ]);
    expect(faqBuckets([])).toEqual([]);
  });

  it('groups by category and by bucket > category, keeping the server order', () => {
    expect(groupByCategory(list.filter((x) => x.bucket === 'Set up & Account')).map((g) => [g.category, ids(g.items)])).toEqual([
      ['Getting Started', ['1', '6']],
      ['Staff Management', ['3']],
    ]);
    const all = groupByBucket(list);
    expect(all.map((g) => g.bucket)).toEqual(['Set up & Account', 'Attendance & Time', 'Pay & Expenses']);
    expect(all[1].categories[0]).toMatchObject({ category: 'Shifts' });
  });

  it('finds a bucket from a link value regardless of case, spacing and the ampersand', () => {
    const b = faqBuckets(list);
    expect(findBucket(b, 'attendance-time')).toBe('Attendance & Time');
    expect(findBucket(b, 'Attendance & Time')).toBe('Attendance & Time');
    expect(findBucket(b, 'PAY  &  EXPENSES')).toBe('Pay & Expenses');
    expect(findBucket(b, 'nope')).toBeNull();
    expect(findBucket(b, undefined)).toBeNull();
    expect(bucketSlug('Set up & Account')).toBe('set-up-account');
  });

  it('gives each known bucket its own icon and a help icon to any other', () => {
    expect(bucketVisual('Attendance & Time').icon).toBe('scan-face');
    expect(bucketVisual('pay & expenses').icon).toBe('wallet');
    expect(bucketVisual('Help & Fixes').icon).toBe('life-buoy');
    expect(bucketVisual('Something new').icon).toBe('help-circle');
  });
});

describe('faq search', () => {
  it('splits the text into lower-case words without empties or duplicates', () => {
    expect(searchWords('  Salary   SHEET salary ')).toEqual(['salary', 'sheet']);
    expect(searchWords('   ')).toEqual([]);
  });

  it('searches question, answer, category and bucket name, case-insensitively', () => {
    expect(ids(searchFaqs(list, 'LOG IN'))).toEqual(['1']);
    expect(ids(searchFaqs(list, 'tap add'))).toEqual(['2']);
    expect(ids(searchFaqs(list, 'password'))).toEqual(['1']); // second line of an answer
    expect(ids(searchFaqs(list, 'shifts'))).toEqual(['2', '5']); // category
    expect(ids(searchFaqs(list, 'pay & exp'))).toEqual(['4']); // words may match the bucket name and the category together
    expect(ids(searchFaqs(list, 'expenses'))).toEqual(['4']); // bucket name
  });

  it('needs every word to match, in any order', () => {
    expect(ids(searchFaqs(list, 'advance salary'))).toEqual(['6']);
    expect(ids(searchFaqs(list, 'salary advance'))).toEqual(['6']);
    expect(searchFaqs(list, 'salary zebra')).toEqual([]);
  });

  it('ranks question matches above answer-only matches and keeps the server order inside a rank', () => {
    // 4 and 6 have "salary" in the question, 5 only in the answer
    expect(ids(searchFaqs(list, 'salary'))).toEqual(['4', '6', '5']);
    // a partial question match (word 1 in the question, word 2 in the answer) ranks below a full one
    expect(ids(searchFaqs(list, 'overtime sheet'))).toEqual(['5']);
  });

  it('returns nothing for a blank query (the caller shows the browse view)', () => {
    expect(searchFaqs(list, '')).toEqual([]);
    expect(searchFaqs(list, '   ')).toEqual([]);
  });

  it('splits a text into matched and plain parts, case-insensitively and regex-safe', () => {
    expect(splitMatches('Where is the Salary sheet?', ['salary', 'sheet'])).toEqual([
      { text: 'Where is the ', match: false },
      { text: 'Salary', match: true },
      { text: ' ', match: false },
      { text: 'sheet', match: true },
      { text: '?', match: false },
    ]);
    expect(splitMatches('plain', [])).toEqual([{ text: 'plain', match: false }]);
    expect(splitMatches('a (b) c', ['(b)'])).toEqual([
      { text: 'a ', match: false },
      { text: '(b)', match: true },
      { text: ' c', match: false },
    ]);
  });
});
