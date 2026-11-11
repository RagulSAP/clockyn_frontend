import { routes } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';

import { DELETION_DEFAULT_MESSAGE, DELETION_REDIRECT_DELAY_MS, submitDeletionRequest } from '../utils/accountDeletion';
import { PERMISSIONS, UNKNOWN_PERMISSIONS, countGranted, permissionAction } from '../utils/permissionsLogic';
import { salaryGate } from '../utils/salaryGate';
import { DESKTOP_COLUMNS, INCENTIVE_OPTIONS, SETTINGS_SECTIONS, isMenuGroup } from '../utils/settingsMenu';
import { replyAuthorLabel, ticketSubmitError, validateSuggestion, validateTicket } from '../utils/support';

describe('settings menu (settings §3.1)', () => {
  it('has the spec sections in order, with Refer & Earn after the plan row and Appearance before Beyond', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual(['plan', 'referral', 'company', 'salary', 'attendance', 'reports', 'roles', 'expenses', 'appearance', 'beyond']);
    expect(SETTINGS_SECTIONS.map((s) => s.title)).toEqual([
      'Your Plan & Validity',
      'Refer & Earn',
      'Company Settings',
      'Salary Structure',
      'Attendance & Devices',
      'View & Download Reports',
      'Managers',
      'Expenses & Allowances',
      'Appearance',
      'Beyond',
    ]);
  });

  it('plain rows navigate to the right routes', () => {
    const route = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id)?.route;
    expect(route('plan')).toBe(routes.admin.billing.overview);
    expect(route('referral')).toBe(routes.admin.referral);
    expect(route('reports')).toBe(routes.admin.reports.hub);
    expect(route('roles')).toBe(routes.admin.managers.list);
  });

  it('accordion children match the spec copy and targets', () => {
    const titles = (id: string) => (SETTINGS_SECTIONS.find((s) => s.id === id)?.children ?? []).map((c) => c.title);
    expect(titles('company')).toEqual(['View Company', 'Add Company', 'Holiday Management']);
    expect(titles('salary')).toEqual(['Monthly Fixed', 'Daily Wages', 'Hourly Calculation', 'Incentive / OT / Bonus', 'Fine / Deduction']);
    expect(titles('attendance')).toEqual(['Shift Setting', 'Assign Devices', 'Attendance Rule']);
    expect(titles('expenses')).toEqual(['Odometer', 'Travel Ticket', 'Other Bills']);
    // "Our Other Applications" is intentionally not ported
    expect(titles('beyond')).toEqual(['Suggest a Feature', 'Support', 'More Options', 'App Permissions', 'Logout']);

    const salary = SETTINGS_SECTIONS.find((s) => s.id === 'salary')?.children ?? [];
    const group = salary.find(isMenuGroup);
    expect(group?.children.map((c) => c.title)).toEqual(['Incentive', 'Overtime', 'Bonus']);
    const fine = salary.find((c) => c.title === 'Fine / Deduction');
    expect(fine && !isMenuGroup(fine) && fine.action).toEqual({ type: 'toast', message: 'Coming soon' });
  });

  it('every route action points at a registered route', () => {
    const valid = new Set<string>(JSON.stringify(routes).match(/"\/[^"]*"/g)?.map((s) => s.slice(1, -1)));
    const actions = SETTINGS_SECTIONS.flatMap((s) => (s.children ?? []).flatMap((c) => (isMenuGroup(c) ? c.children : [c])).map((l) => l.action));
    for (const a of actions) if (a.type === 'route') expect(valid.has(a.route)).toBe(true);
    for (const o of INCENTIVE_OPTIONS) expect(valid.has(o.route)).toBe(true);
  });

  it('the desktop columns cover every section exactly once', () => {
    expect([...DESKTOP_COLUMNS.flat()].sort()).toEqual(SETTINGS_SECTIONS.map((s) => s.id).sort());
  });
});

describe('Salary Structure plan gate', () => {
  const status = (over: Partial<{ plan_id: number | null; is_free_trial: boolean; is_expired: boolean }>) => ({
    plan_id: 1 as number | null,
    is_free_trial: false,
    is_expired: false,
    ...over,
  });

  it('active paid plans (core, prime, elite) are not blocked', () => {
    for (const plan_id of [1, 2, 3]) expect(salaryGate(status({ plan_id })).blocked).toBe(false);
  });

  it('a free trial is never blocked', () => {
    expect(salaryGate(status({ plan_id: null, is_free_trial: true })).blocked).toBe(false);
    expect(salaryGate(status({ plan_id: null, is_free_trial: true, is_expired: true })).blocked).toBe(false);
  });

  it('expired plan or no plan (without trial) is blocked with the subscribe message', () => {
    for (const s of [status({ is_expired: true }), status({ plan_id: null })]) {
      const g = salaryGate(s);
      expect(g.blocked).toBe(true);
      expect(g.subtitle).toBe('Upgrade plan to access');
      expect(g.message).toBe('Your free trial has ended. Please subscribe to the Core Plan to continue accessing this feature.');
    }
  });

  it('an unknown status (loading or failed) fails open', () => {
    expect(salaryGate(null)).toEqual({ blocked: false, subtitle: 'Pay templates & rules', message: '' });
    expect(salaryGate(undefined).blocked).toBe(false);
  });
});

describe('account deletion request flow', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const makeDeps = (message = 'Request received') => ({
    requestDeletion: jest.fn(async () => ({ message })),
    patchSession: jest.fn(),
    signOut: jest.fn(async () => undefined),
  });

  it('marks the session inactive, returns the server message and signs out after 1.5 s', async () => {
    const deps = makeDeps();
    const message = await submitDeletionRequest('u1', deps);
    expect(message).toBe('Request received');
    expect(deps.requestDeletion).toHaveBeenCalledWith('u1');
    expect(deps.patchSession).toHaveBeenCalledWith({ isActive: 0 });
    expect(deps.signOut).not.toHaveBeenCalled();
    jest.advanceTimersByTime(DELETION_REDIRECT_DELAY_MS - 1);
    expect(deps.signOut).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(deps.signOut).toHaveBeenCalledWith({ reason: 'deleted' });
  });

  it('falls back to the default message when the server sends none', async () => {
    expect(await submitDeletionRequest('u1', makeDeps(''))).toBe(DELETION_DEFAULT_MESSAGE);
  });

  it('a failed request leaves the user signed in and the session untouched', async () => {
    const deps = makeDeps();
    deps.requestDeletion.mockRejectedValueOnce(new ApiError({ status: 400, detail: 'Already requested' }));
    await expect(submitDeletionRequest('u1', deps)).rejects.toThrow('Already requested');
    expect(deps.patchSession).not.toHaveBeenCalled();
    jest.advanceTimersByTime(DELETION_REDIRECT_DELAY_MS * 2);
    expect(deps.signOut).not.toHaveBeenCalled();
  });
});

describe('permissions logic', () => {
  it('location, camera, notifications and photos are listed', () => {
    expect(PERMISSIONS.map((p) => p.kind)).toEqual(['location', 'camera', 'notifications', 'photos']);
  });

  it('counts granted permissions', () => {
    expect(countGranted(UNKNOWN_PERMISSIONS)).toBe(0);
    expect(countGranted({ ...UNKNOWN_PERMISSIONS, camera: { status: 'granted', canAskAgain: true }, photos: { status: 'granted', canAskAgain: true } })).toBe(2);
  });

  it('tap action: nothing when granted, request while the prompt can be shown, settings / instructions once blocked', () => {
    expect(permissionAction({ status: 'granted', canAskAgain: true }, 'android')).toBe('none');
    expect(permissionAction({ status: 'undetermined', canAskAgain: true }, 'ios')).toBe('request');
    expect(permissionAction({ status: 'denied', canAskAgain: true }, 'android')).toBe('request');
    expect(permissionAction({ status: 'denied', canAskAgain: false }, 'android')).toBe('open-settings');
    expect(permissionAction({ status: 'denied', canAskAgain: false }, 'ios')).toBe('open-settings');
    expect(permissionAction({ status: 'denied', canAskAgain: false }, 'web')).toBe('browser-instructions');
  });
});

describe('support helpers', () => {
  it('ticket validation checks the subject first', () => {
    expect(validateTicket('', '')).toBe('Please select a subject');
    expect(validateTicket('Billing', '   ')).toBe('Please enter a message');
    expect(validateTicket('Billing', 'Help')).toBeNull();
  });

  it('suggestion validation checks the subject first', () => {
    expect(validateSuggestion(' ', 'x')).toBe('Please enter a subject');
    expect(validateSuggestion('Idea', '')).toBe('Please enter your message');
    expect(validateSuggestion('Idea', 'Details')).toBeNull();
  });

  it('thread author labels', () => {
    expect(replyAuthorLabel({ isAdmin: true, authorName: 'Priya' })).toBe('Priya');
    expect(replyAuthorLabel({ isAdmin: true, authorName: '  ' })).toBe('Admin');
    expect(replyAuthorLabel({ isAdmin: false, authorName: 'Someone' })).toBe('You');
  });

  it('submit errors: timeout wording, server detail, HTTP status, generic', () => {
    expect(ticketSubmitError(new ApiError({ status: 0, isTimeout: true }))).toBe('Upload timed out. Please check your connection and try again.');
    expect(ticketSubmitError(new ApiError({ status: 400, detail: 'Invalid subject: x' }))).toBe('Invalid subject: x');
    expect(ticketSubmitError(new ApiError({ status: 502 }))).toBe('Submission failed (HTTP 502)');
    expect(ticketSubmitError(new Error('boom'))).toBe('boom');
  });
});
