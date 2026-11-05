import { PLAN_PANEL_MESSAGES } from '@/config/plans';
import { routes } from '@/config/routes';
import { ADMIN_BLOCKED_FALLBACK, ADMIN_HUB_ITEMS, STAFF_HUB_ITEMS, badgeFor, decideChatGate } from '../hubLogic';

const gate = (over: Partial<Parameters<typeof decideChatGate>[0]> = {}) =>
  decideChatGate({ isLoading: false, blocked: false, audience: 'admin', message: '', platformOS: 'android', ...over });

describe('chat plan-gate decision', () => {
  it('waits (no menu flash) while the plan status is loading', () => {
    expect(gate({ isLoading: true, blocked: true })).toEqual({ kind: 'checking' });
  });

  it('is open when not blocked (trial, active plan, or status unknown = fail open)', () => {
    expect(gate()).toEqual({ kind: 'open' });
    expect(gate({ audience: 'staff' })).toEqual({ kind: 'open' });
  });

  it('admin blocked: "Feature Unavailable" + message + Renew Plan to billing', () => {
    expect(gate({ blocked: true, message: 'Your free trial has ended.' })).toEqual({
      kind: 'blocked',
      title: 'Feature Unavailable',
      message: 'Your free trial has ended.',
      cta: { label: 'Renew Plan', route: routes.admin.billing.overview },
    });
  });

  it('admin blocked on iOS: "View Plan Status"', () => {
    const g = gate({ blocked: true, platformOS: 'ios' });
    expect(g.kind === 'blocked' && g.cta?.label).toBe('View Plan Status');
  });

  it('admin blocked with no message falls back to the trial-ended text', () => {
    const g = gate({ blocked: true });
    expect(g.kind === 'blocked' && g.message).toBe(ADMIN_BLOCKED_FALLBACK);
  });

  it('staff blocked: "Chat Unavailable", contact-your-admin text and NO action', () => {
    expect(gate({ blocked: true, audience: 'staff', message: '' })).toEqual({
      kind: 'blocked',
      title: 'Chat Unavailable',
      message: PLAN_PANEL_MESSAGES.staff,
      cta: null,
    });
    const g = gate({ blocked: true, audience: 'staff', platformOS: 'ios', message: 'custom' });
    expect(g.kind === 'blocked' && g.cta).toBeNull();
    expect(g.kind === 'blocked' && g.message).toBe('custom');
  });
});

describe('hub menus', () => {
  it('admin: Individual, Group, Announcement, Branch & Dept -> admin comms routes', () => {
    expect(ADMIN_HUB_ITEMS.map((i) => i.title)).toEqual(['Individual Chat', 'Group Chat', 'Announcement', 'Branch & Dept']);
    expect(ADMIN_HUB_ITEMS.map((i) => i.route)).toEqual([
      routes.admin.comms.direct,
      routes.admin.comms.groups,
      routes.admin.comms.announcements,
      routes.admin.comms.announcementsTargeted,
    ]);
    // admin announcement cards never carry a badge
    expect(ADMIN_HUB_ITEMS.filter((i) => i.badge).map((i) => i.badge)).toEqual(['individual', 'group']);
  });

  it('staff: Individual, Group, Broadcast, Targeted -> staff comms routes, all with badges', () => {
    expect(STAFF_HUB_ITEMS.map((i) => i.title)).toEqual(['Individual Chat', 'Group Chat', 'Broadcast', 'Targeted Announcement']);
    expect(STAFF_HUB_ITEMS.map((i) => i.route)).toEqual([
      routes.staff.comms.direct,
      routes.staff.comms.groups,
      routes.staff.comms.broadcast,
      routes.staff.comms.targeted,
    ]);
    expect(STAFF_HUB_ITEMS.map((i) => i.badge)).toEqual(['individual', 'group', 'broadcast', 'targeted']);
  });

  it('badgeFor reads the right counter and ignores invalid values', () => {
    const counts = { individual: 5, group: 0, broadcast: 120, targeted: Number.NaN };
    expect(badgeFor(STAFF_HUB_ITEMS[0], counts)).toBe(5);
    expect(badgeFor(STAFF_HUB_ITEMS[1], counts)).toBe(0);
    expect(badgeFor(STAFF_HUB_ITEMS[2], counts)).toBe(120);
    expect(badgeFor(STAFF_HUB_ITEMS[3], counts)).toBe(0);
    expect(badgeFor(ADMIN_HUB_ITEMS[2], counts)).toBe(0); // no badge key
  });
});
