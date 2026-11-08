/**
 * Q7 - Support > FAQ (admin only), web export against the stateful mock backend.
 *
 * 6 buckets > 18 categories > 36 active FAQs (the inactive one is never served). Phone: a landing of bucket tiles, a bucket view
 * (back arrow / browser back return to the tiles) and chips to jump between buckets. Desktop: a sticky bucket list on the left and
 * the questions on the right. Every FAQ is an EXPANDABLE row (tap / click opens the answer in place, again closes it, rows are
 * independent, Enter / Space work). Search always covers ALL buckets (ranked, highlighted, "bucket > category" chips, empty
 * state with actions), a bucket can be deep-linked, and managers / staff cannot open the screen.
 * Runs on both projects: desktop uses mouse clicks, phone uses real touch taps.
 */
import type { Locator, Page, TestInfo } from '@playwright/test';

import { expect, loginAs, test, visit } from '../support';
import { snap } from '../support/q3';

const supportNav = (page: Page) => page.locator('[data-testid="tab-support"], [data-testid="sidebar-support"]');
const isPhone = (testInfo: TestInfo) => testInfo.project.name === 'phone';

/** A touch tap on the phone project, a mouse click on desktop. */
const press = (testInfo: TestInfo, loc: Locator) => (isPhone(testInfo) ? loc.tap() : loc.click());

const row = (page: Page, id: number) => page.getByTestId(`faq-${id}`);
const answer = (page: Page, id: number) => page.getByTestId(`faq-${id}-answer`);
const searchBox = (page: Page) => page.getByTestId('faq-search');

const BUCKETS = [
  { slug: 'set-up-account', name: 'Set up & Account', count: 8 },
  { slug: 'attendance-time', name: 'Attendance & Time', count: 10 },
  { slug: 'pay-expenses', name: 'Pay & Expenses', count: 4 },
  { slug: 'team-customers', name: 'Team & Customers', count: 4 },
  { slug: 'plans-payments', name: 'Plans & Payments', count: 4 },
  { slug: 'help-fixes', name: 'Help & Fixes', count: 6 },
];

async function openFaq(page: Page): Promise<void> {
  await expect(page.getByTestId('faq-screen')).toBeVisible();
  await expect(searchBox(page)).toBeVisible();
}

/** Opens a bucket the way the viewport offers it: a tile on phones, an entry of the left list on desktop. */
async function openBucket(page: Page, testInfo: TestInfo, slug: string): Promise<void> {
  await press(testInfo, page.getByTestId(isPhone(testInfo) ? `faq-bucket-${slug}` : `faq-nav-${slug}`));
  await expect(page.getByTestId('faq-bucket-view')).toBeVisible();
}

test.describe('FAQ (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('Support -> FAQ opens the landing: bucket tiles on phone, a bucket list with all questions on desktop', async ({ page }, testInfo) => {
    await visit(page, '/admin/home');
    await supportNav(page).click();
    await expect(page.getByTestId('support-hub-screen')).toBeVisible();
    await expect(page.getByText('Soon', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Answers to common questions').first()).toBeVisible();
    await page.getByTestId('support-faq').click();
    await page.waitForURL('**/admin/help/faq');
    await openFaq(page);
    await expect(page.getByText('Retired question that must stay hidden')).toHaveCount(0);

    if (isPhone(testInfo)) {
      // a tile per bucket in server order, each with "N questions" and its categories; no flat list of questions
      const tiles = page.locator('[data-testid^="faq-bucket-"]');
      await expect(tiles).toHaveCount(6);
      expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))).toEqual(BUCKETS.map((b) => `faq-bucket-${b.slug}`));
      for (const b of BUCKETS) {
        const tile = page.getByTestId(`faq-bucket-${b.slug}`);
        await expect(tile).toContainText(b.name);
        await expect(tile).toContainText(`${b.count} questions`);
      }
      await expect(page.getByTestId('faq-bucket-pay-expenses')).toContainText('Payroll & Salary · Expenses & Advances');
      await expect(row(page, 1)).toHaveCount(0);
      const cols = await page.getByTestId('faq-tiles').evaluate((el) => new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().left))).size);
      expect(cols).toBe(2); // two columns on a phone
    } else {
      const nav = page.getByTestId('faq-nav');
      await expect(nav).toBeVisible();
      await expect(page.getByTestId('faq-nav-all')).toContainText('All questions');
      await expect(page.getByTestId('faq-nav-all')).toContainText('36');
      for (const b of BUCKETS) {
        await expect(page.getByTestId(`faq-nav-${b.slug}`)).toContainText(b.name);
        await expect(page.getByTestId(`faq-nav-${b.slug}`)).toContainText(String(b.count));
      }
      await expect(page.getByTestId('faq-nav-all')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('faq-all-view')).toBeVisible();
      await expect(row(page, 1)).toBeVisible();
      await expect(page.getByTestId('faq-category-payroll-salary')).toBeVisible();
      // the list stays in view while the questions scroll (sticky)
      await page.getByTestId('faq-help-card').scrollIntoViewIfNeeded();
      await expect(nav).toBeInViewport();
      await expect(page.locator('[data-testid^="faq-bucket-"]')).toHaveCount(0); // no tiles on desktop
    }
    await snap(page, testInfo, 'faq-landing');
  });

  test('opening a bucket shows its categories as sub-headers with collapsed questions; chips / the list jump between buckets', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await openBucket(page, testInfo, 'attendance-time');

    for (const c of ['Attendance & Face Punch', 'Shifts', 'Holidays & Rules', 'Leave & Requests', 'Reports & Analytics']) {
      await expect(page.getByTestId('faq-bucket-view').getByText(`${c} · 2`, { exact: true })).toBeVisible();
    }
    await expect(row(page, 9)).toBeVisible();
    await expect(row(page, 9)).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 1)).toHaveCount(0); // another bucket
    await expect(page.getByText('10 questions').first()).toBeVisible();
    await expect(page.getByTestId('faq-help-card')).toBeVisible();
    await snap(page, testInfo, 'faq-bucket');

    if (isPhone(testInfo)) {
      await press(testInfo, page.getByTestId('faq-chips').getByRole('radio', { name: 'Pay & Expenses, 4' }));
      await expect(row(page, 19)).toBeVisible();
      await expect(row(page, 9)).toHaveCount(0);
    } else {
      await press(testInfo, page.getByTestId('faq-nav-pay-expenses'));
      await expect(row(page, 19)).toBeVisible();
      await expect(row(page, 9)).toHaveCount(0);
      await expect(page.getByTestId('faq-nav-pay-expenses')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('faq-nav-all')).toHaveAttribute('aria-selected', 'false');
      await press(testInfo, page.getByTestId('faq-nav-all'));
      await expect(row(page, 1)).toBeVisible();
      await expect(row(page, 19)).toBeVisible();
    }
  });

  test('phone: the back arrow and the browser back return from a bucket to the tiles', async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo), 'the tiles flow is the phone layout');
    await visit(page, '/admin/home');
    await supportNav(page).click(); // arrive the way a user does, so the browser history has an entry to go back to
    await page.getByTestId('support-faq').click();
    await page.waitForURL('**/admin/help/faq');
    await openFaq(page);

    await openBucket(page, testInfo, 'help-fixes');
    await page.getByLabel('Go back').tap();
    await expect(page.getByTestId('faq-tiles')).toBeVisible();
    await expect(page.getByTestId('faq-bucket-view')).toHaveCount(0);

    await openBucket(page, testInfo, 'help-fixes');
    await page.goBack(); // browser / system back: still on the FAQ, at the tiles
    await expect(page.getByTestId('faq-tiles')).toBeVisible();
    await expect(page.getByTestId('faq-bucket-view')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/admin/help/faq');

    // opening Live Chat from a bucket and coming back keeps the bucket open
    await openBucket(page, testInfo, 'help-fixes');
    await page.getByTestId('faq-chat-support').tap();
    await page.waitForURL('**/admin/help/live-chat');
    await page.goBack();
    await page.waitForURL('**/admin/help/faq');
    await expect(page.getByTestId('faq-bucket-view')).toBeVisible();

    // and one more back goes on to the Support hub
    await page.goBack();
    await expect(page.getByTestId('faq-tiles')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('support-hub-screen')).toBeVisible();
  });

  test('a question opens its answer in place and closes it again; two can be open together', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await openBucket(page, testInfo, 'attendance-time');

    // before: only the questions, every row collapsed
    await expect(answer(page, 9)).toHaveCount(0);
    await expect(page.getByText('The punch is saved only when the face matches.')).toHaveCount(0);
    await expect(row(page, 9)).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 9)).toHaveAttribute('role', 'button');

    // open: the multi-line answer shows directly under the question
    await press(testInfo, row(page, 9));
    await expect(answer(page, 9)).toBeVisible();
    await expect(row(page, 9)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('The punch is saved only when the face matches.')).toBeVisible();
    await expect(page.getByText('Staff tap Punch In on their home screen.')).toBeVisible();
    const q = (await row(page, 9).boundingBox())!;
    const a = (await answer(page, 9).boundingBox())!;
    expect(a.y).toBeGreaterThanOrEqual(q.y + q.height - 1); // opens beneath its question, not elsewhere
    expect(a.height).toBeGreaterThan(40); // all three lines, not squeezed by the animation
    expect((await answer(page, 9).innerText()).split('\n')).toHaveLength(3); // the line breaks of the answer are kept
    await page.waitForTimeout(400); // let the open animation settle for the screenshot
    await snap(page, testInfo, 'faq-expanded');

    // a second FAQ opens WITHOUT closing the first
    await press(testInfo, row(page, 11));
    await expect(answer(page, 11)).toBeVisible();
    await expect(answer(page, 9)).toBeVisible();
    await expect(row(page, 11)).toHaveAttribute('aria-expanded', 'true');
    await expect(row(page, 9)).toHaveAttribute('aria-expanded', 'true');
    await expect(answer(page, 10)).toHaveCount(0); // untouched rows stay collapsed

    // second tap collapses just that one
    await press(testInfo, row(page, 9));
    await expect(row(page, 9)).toHaveAttribute('aria-expanded', 'false');
    await expect(answer(page, 9)).toHaveCount(0);
    await expect(page.getByText('The punch is saved only when the face matches.')).toHaveCount(0);
    await expect(answer(page, 11)).toBeVisible();
  });

  test('the keyboard works: Enter and Space toggle a focused question', async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), 'keyboard navigation is a desktop concern');
    await visit(page, '/admin/help/faq');
    await openFaq(page);

    await row(page, 2).focus();
    await page.keyboard.press('Enter');
    await expect(answer(page, 2)).toBeVisible();
    await expect(row(page, 2)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(answer(page, 2)).toHaveCount(0);

    await page.keyboard.press('Space');
    await expect(answer(page, 2)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(answer(page, 2)).toHaveCount(0);
    await expect(row(page, 2)).toHaveAttribute('aria-expanded', 'false');
  });

  test('search covers ALL buckets: ranked, with bucket > category chips and the matched words in bold', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);

    await searchBox(page).fill('INVOICE'); // case-insensitive; from the landing, across every bucket
    await expect(page.getByTestId('faq-result-count')).toHaveText('3 results');
    await expect(page.getByTestId('faq-tiles')).toHaveCount(0);
    // the question match first (29), then the answer / category matches in server order (27, 30)
    const order = await page.locator('[data-testid^="faq-item-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order).toEqual(['faq-item-29', 'faq-item-27', 'faq-item-30']);
    await expect(page.getByTestId('faq-29-chip')).toHaveText('Plans & Payments > Payments & Invoices');
    await expect(page.getByTestId('faq-27-chip')).toHaveText('Plans & Payments > Plans & Billing');
    await expect(row(page, 29).getByTestId('faq-match').first()).toHaveText('invoice');
    // matches stay collapsed; once opened the answer highlights them too
    await expect(row(page, 27)).toHaveAttribute('aria-expanded', 'false');
    await press(testInfo, row(page, 27));
    await expect(answer(page, 27)).toBeVisible();
    await expect(answer(page, 27).getByTestId('faq-match')).toHaveCount(2); // "invoice" and "Invoices"
    await snap(page, testInfo, 'faq-search');

    await searchBox(page).fill('advance salary'); // every word, any order
    await expect(page.getByTestId('faq-result-count')).toHaveText('1 result');
    await expect(row(page, 22)).toBeVisible();
    await searchBox(page).fill('SELFIE'); // only in an answer
    await expect(page.getByTestId('faq-result-count')).toHaveText('1 result');
    await expect(row(page, 9)).toBeVisible();
    await searchBox(page).fill('pay expenses'); // category / bucket words
    await expect(row(page, 19)).toBeVisible();
  });

  test('clearing the search returns to the view you were in, and open rows stay open', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await openBucket(page, testInfo, 'plans-payments');
    await press(testInfo, row(page, 29));
    await expect(answer(page, 29)).toBeVisible();

    await searchBox(page).fill('shift');
    await expect(page.getByTestId('faq-results')).toBeVisible();
    await expect(page.getByTestId('faq-bucket-view')).toHaveCount(0);
    await page.getByLabel('Clear search').first().click(); // the (x) in the search bar
    await expect(searchBox(page)).toHaveValue('');
    await expect(page.getByTestId('faq-bucket-view')).toBeVisible();
    await expect(row(page, 27)).toBeVisible();
    await expect(row(page, 29)).toHaveAttribute('aria-expanded', 'true'); // collapse state survived the search
    await expect(answer(page, 29)).toBeVisible();
  });

  test('no results shows a friendly state with Clear search, Browse topics and Ask support in Live Chat', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await openBucket(page, testInfo, 'pay-expenses');

    await searchBox(page).fill('zzzz-nothing');
    await expect(page.getByText('No answers match')).toBeVisible();
    await expect(page.getByTestId('faq-help-card')).toBeVisible();
    await snap(page, testInfo, 'faq-no-match');
    await press(testInfo, page.getByTestId('faq-clear-search')); // back to the view you were in
    await expect(searchBox(page)).toHaveValue('');
    await expect(page.getByTestId('faq-bucket-view')).toBeVisible();
    await expect(page.getByText('No answers match')).toHaveCount(0);

    await searchBox(page).fill('zzzz-nothing');
    await press(testInfo, page.getByTestId('faq-browse-topics')); // all the way back to the topics
    await expect(page.getByText('No answers match')).toHaveCount(0);
    await expect(page.getByTestId(isPhone(testInfo) ? 'faq-tiles' : 'faq-all-view')).toBeVisible();

    await searchBox(page).fill('zzzz-nothing');
    await press(testInfo, page.getByTestId('faq-ask-support'));
    await page.waitForURL('**/admin/help/live-chat');
    await expect(page.getByTestId('live-chat-screen')).toBeVisible();
  });

  test('a bucket can be deep-linked with `bucket` (and narrowed with `category`)', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq', { bucket: 'pay-expenses' });
    await openFaq(page);
    await expect(page.getByTestId('faq-bucket-view')).toBeVisible();
    for (const id of [19, 20, 21, 22]) await expect(row(page, id)).toBeVisible();
    await expect(row(page, 1)).toHaveCount(0);
    if (isPhone(testInfo)) await expect(page.getByTestId('faq-tiles')).toHaveCount(0);
    else await expect(page.getByTestId('faq-nav-pay-expenses')).toHaveAttribute('aria-selected', 'true');

    await visit(page, '/admin/help/faq', { bucket: 'Pay & Expenses', category: 'Expenses & Advances' });
    await expect(row(page, 21)).toBeVisible();
    await expect(row(page, 22)).toBeVisible();
    await expect(row(page, 19)).toHaveCount(0);
    await press(testInfo, page.getByTestId('faq-show-all-categories'));
    await expect(row(page, 19)).toBeVisible();

    if (isPhone(testInfo)) {
      await page.getByLabel('Go back').tap(); // a link opened the bucket, back still shows the tiles
      await expect(page.getByTestId('faq-tiles')).toBeVisible();
    }
  });

  test('"Chat with support" opens Live Chat and "Watch guides" opens the Video Hub', async ({ page }, testInfo) => {
    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await expect(page.getByText('Still need help?')).toBeVisible();
    await press(testInfo, page.getByTestId('faq-chat-support'));
    await page.waitForURL('**/admin/help/live-chat');
    await expect(page.getByTestId('live-chat-screen')).toBeVisible();

    await visit(page, '/admin/help/faq');
    await openFaq(page);
    await press(testInfo, page.getByTestId('faq-watch-guides'));
    await page.waitForURL('**/admin/help/videos');
  });
});

test.describe('FAQ load failure', () => {
  test.use({ failOnPageIssues: false }); // the injected 500 is the point of this test

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('a failed load shows the error with a retry that loads the list', async ({ page, mock }, testInfo) => {
    await mock.failNext('/support/faqs', { status: 500, times: 1 });
    await visit(page, '/admin/help/faq');
    await expect(page.getByTestId('faq-screen')).toBeVisible();
    await expect(page.getByText('Try again')).toBeVisible(); // error state with retry
    await press(testInfo, page.getByText('Try again'));
    await expect(searchBox(page)).toBeVisible(); // the retry loaded the list
  });
});

test.describe('FAQ visual QA (light and dark)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`screenshots: landing, bucket, expanded row and search result (${theme})`, async ({ page }, testInfo) => {
      await loginAs(page, 'admin', { theme });
      await visit(page, '/admin/help/faq');
      await openFaq(page);
      await snap(page, testInfo, `faq-${theme}-1-landing`);
      await openBucket(page, testInfo, 'attendance-time');
      await snap(page, testInfo, `faq-${theme}-2-bucket`);
      await press(testInfo, row(page, 9));
      await expect(answer(page, 9)).toBeVisible();
      await page.waitForTimeout(400);
      await snap(page, testInfo, `faq-${theme}-3-expanded`);
      await searchBox(page).fill('face punch');
      await expect(page.getByTestId('faq-results')).toBeVisible();
      await snap(page, testInfo, `faq-${theme}-4-search`);
    });
  }
});

test.describe('FAQ is for the admin only', () => {
  for (const role of ['manager', 'staff'] as const) {
    test(`${role}: /admin/help/faq is not reachable`, async ({ page }) => {
      await loginAs(page, role);
      await visit(page, '/admin/help/faq');
      await page.waitForURL('**/staff/home');
      await expect(page.getByTestId('faq-screen')).toHaveCount(0);
      await expect(page.getByText('Still need help?')).toHaveCount(0);
    });
  }
});
