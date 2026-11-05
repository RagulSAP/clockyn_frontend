import { routes } from '@/config/routes';
import { foregroundLocalNotification, normalizePushData, openEventKey, parseNotificationTarget } from '../notificationRouting';

describe('parseNotificationTarget', () => {
  it('routes punch notifications to the admin home', () => {
    expect(parseNotificationTarget({ type: 'punch_in' })).toEqual({ route: routes.admin.home, params: {} });
    expect(parseNotificationTarget({ type: 'punch_out' })).toEqual({ route: routes.admin.home, params: {} });
  });

  it('routes ticket / poll / announcement to the staff home (admin home for role 1)', () => {
    for (const type of ['ticket_resolved', 'new_poll', 'poll_approved', 'announcement']) {
      expect(parseNotificationTarget({ type })?.route).toBe(routes.staff.home);
      expect(parseNotificationTarget({ type, role_id: '1' })?.route).toBe(routes.admin.home);
    }
  });

  it('routes chat by role and passes the sender id', () => {
    expect(parseNotificationTarget({ type: 'new_chat_message', role_id: '1', sender_id: 'u9' })).toEqual({
      route: routes.admin.comms.direct,
      params: { userId: 'u9' },
    });
    expect(parseNotificationTarget({ type: 'new_chat_message', role_id: '3' })).toEqual({ route: routes.staff.comms.direct, params: {} });
    // numeric role_id (FCM data is string-only, but be lenient)
    expect(parseNotificationTarget({ type: 'new_chat_message', role_id: 1 })?.route).toBe(routes.admin.comms.direct);
    expect(parseNotificationTarget({ type: 'new_message', role_id: '2' })?.route).toBe(routes.staff.comms.direct);
  });

  it('routes group chat by role and passes the group id', () => {
    expect(parseNotificationTarget({ type: 'new_group_message', role_id: '1', group_id: '12' })).toEqual({
      route: routes.admin.comms.groups,
      params: { groupId: '12' },
    });
    expect(parseNotificationTarget({ type: 'new_group_message' })).toEqual({ route: routes.staff.comms.groups, params: {} });
  });

  it('the signed-in role overrides the payload role', () => {
    expect(parseNotificationTarget({ type: 'new_chat_message', role_id: '3' }, { roleId: 1 })?.route).toBe(routes.admin.comms.direct);
    expect(parseNotificationTarget({ type: 'new_chat_message', role_id: '1' }, { roleId: 3 })?.route).toBe(routes.staff.comms.direct);
  });

  it('routes requests', () => {
    expect(parseNotificationTarget({ type: 'request_submitted' })?.route).toBe(routes.admin.requests.hub);
    expect(parseNotificationTarget({ type: 'request_updated' })?.route).toBe(routes.staff.requests.hub);
  });

  it('returns null for force_logout, unknown, missing or empty payloads', () => {
    expect(parseNotificationTarget({ type: 'force_logout' })).toBeNull();
    expect(parseNotificationTarget({ type: 'something_else' })).toBeNull();
    expect(parseNotificationTarget({})).toBeNull();
    expect(parseNotificationTarget(null)).toBeNull();
    expect(parseNotificationTarget(undefined)).toBeNull();
  });
});

describe('normalizePushData', () => {
  it('keeps strings, stringifies numbers/booleans and drops the rest', () => {
    expect(normalizePushData({ a: 'x', b: 2, c: true, d: null, e: { z: 1 }, f: undefined })).toEqual({ a: 'x', b: '2', c: 'true' });
    expect(normalizePushData(null)).toEqual({});
    expect(normalizePushData('nope')).toEqual({});
  });
});

describe('foregroundLocalNotification', () => {
  it('re-displays chat and group messages with the v1 default titles', () => {
    expect(foregroundLocalNotification({ data: { type: 'new_message' } })).toMatchObject({ title: 'New Message', body: '' });
    expect(foregroundLocalNotification({ data: { type: 'new_chat_message' }, title: 'Ann', body: 'hi' })).toMatchObject({ title: 'Ann', body: 'hi' });
    expect(foregroundLocalNotification({ data: { type: 'new_group_message' } })).toMatchObject({ title: 'New Group Message' });
  });
  it('ignores every other type', () => {
    for (const type of ['punch_in', 'announcement', 'request_updated', 'force_logout']) {
      expect(foregroundLocalNotification({ data: { type } })).toBeNull();
    }
  });
});

describe('openEventKey', () => {
  it('prefers the message id', () => {
    expect(openEventKey({ data: {}, messageId: 'm1', source: 'remote' })).toBe('id:m1');
    expect(openEventKey({ data: { type: 't' }, title: 'a', body: 'b', source: 'local' })).toBe('t:t|a|b');
  });
});
