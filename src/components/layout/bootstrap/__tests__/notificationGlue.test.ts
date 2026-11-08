import { routes } from '@/config/routes';
import type { PushMessage } from '@/lib/platform/notificationRouting';
import { areaOfRoute, createOpenDeduper, resolveTapTarget } from '../notificationGlue';

const msg = (data: Record<string, string>, extra: Partial<PushMessage> = {}): PushMessage => ({ data, source: 'remote', ...extra });

describe('areaOfRoute', () => {
  it('detects the role area of a route', () => {
    expect(areaOfRoute('/admin/home')).toBe('admin');
    expect(areaOfRoute('/staff/chat/direct')).toBe('staff');
    expect(areaOfRoute('/administrator')).toBeNull();
    expect(areaOfRoute('/')).toBeNull();
  });
});

describe('resolveTapTarget', () => {
  it('opens nothing when signed out', () => {
    expect(resolveTapTarget(msg({ type: 'punch_in' }), null)).toBeNull();
    expect(resolveTapTarget(msg({ type: 'punch_in' }), undefined)).toBeNull();
  });

  it('routes admin pushes by the session role, not the payload', () => {
    expect(resolveTapTarget(msg({ type: 'new_chat_message', sender_id: 's1', role_id: '3' }), { roleId: 1 })).toEqual({
      route: '/admin/chat/direct',
      params: { userId: 's1' },
    });
    expect(resolveTapTarget(msg({ type: 'new_group_message', group_id: 'g1' }), { roleId: 3 })).toEqual({
      route: '/staff/chat/groups',
      params: { groupId: 'g1' },
    });
  });

  it('sends managers (role 2) to admin screens for admin events', () => {
    expect(resolveTapTarget(msg({ type: 'punch_in' }), { roleId: 2 })).toEqual({ route: '/admin/home', params: {} });
    expect(resolveTapTarget(msg({ type: 'request_submitted' }), { roleId: 2 })).toEqual({ route: '/admin/requests', params: {} });
  });

  it('falls back to the role home when the role may not open the target', () => {
    expect(resolveTapTarget(msg({ type: 'punch_in' }), { roleId: 3 })).toEqual({ route: '/staff/home', params: {} });
    expect(resolveTapTarget(msg({ type: 'request_updated' }), { roleId: 1 })).toEqual({ route: '/admin/home', params: {} });
  });

  it('ignores force_logout and unknown types', () => {
    expect(resolveTapTarget(msg({ type: 'force_logout' }), { roleId: 3 })).toBeNull();
    expect(resolveTapTarget(msg({ type: 'who_knows' }), { roleId: 3 })).toBeNull();
    expect(resolveTapTarget(msg({}), { roleId: 3 })).toBeNull();
  });

  it('ignores an invalid role', () => {
    expect(resolveTapTarget(msg({ type: 'punch_in' }), { roleId: 9 })).toBeNull();
  });
});

describe('resolveTapTarget (live chat)', () => {
  it('opens Live Chat for the admin', () => {
    expect(resolveTapTarget({ data: { type: 'live_chat_message', org_id: 'o1' } }, { roleId: 1 })).toEqual({ route: routes.admin.helpLiveChat, params: {} });
  });
  it('opens nothing for a manager or staff member', () => {
    expect(resolveTapTarget({ data: { type: 'live_chat_message' } }, { roleId: 2 })).toBeNull();
    expect(resolveTapTarget({ data: { type: 'live_chat_message' } }, { roleId: 3 })).toBeNull();
  });
});

describe('createOpenDeduper', () => {
  it('suppresses the same message within the window and lets it through afterwards', () => {
    let t = 1000;
    const isDup = createOpenDeduper(5000, () => t);
    const m = msg({ type: 'new_message' }, { messageId: 'abc' });
    expect(isDup(m)).toBe(false);
    t += 1000;
    expect(isDup(m)).toBe(true);
    t += 6000;
    expect(isDup(m)).toBe(false);
  });
  it('keeps different messages apart', () => {
    const isDup = createOpenDeduper();
    expect(isDup(msg({ type: 'a' }, { messageId: '1' }))).toBe(false);
    expect(isDup(msg({ type: 'a' }, { messageId: '2' }))).toBe(false);
  });
});
