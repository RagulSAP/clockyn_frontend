/**
 * Live Chat started by SUPPORT (the admin never opened the screen, no history is loaded): the global socket and the foreground push
 * raise the Support badge exactly once, only for an admin, and never while the conversation is on screen.
 */
import { handlePushData, handleSocketFrame, resetGlobalRealtime, setGlobalSocketOpen } from '@/lib/realtime/globalRealtime';
import { liveChatSession } from '@/lib/realtime/liveChatSession';
import { badges, resetBadges } from '@/store/badges';

import { signInTestAdmin } from '../../../features/settings/__tests__/testHelpers';

const frame = (over: Record<string, unknown> = {}) => ({
  type: 'live_chat_message',
  data: { org_id: 'org-1', message_id: 'lcm-1', sender_type: 'support', sender_id: 'agent@clockyn.test', sender_name: 'Meera', message: 'Hello from support', ...over },
});

beforeEach(() => {
  resetGlobalRealtime();
  resetBadges();
  liveChatSession.setOpen(false);
  setGlobalSocketOpen(true);
  signInTestAdmin();
});

describe('a support-first Live Chat conversation, app not on the chat screen', () => {
  it('a socket frame raises the Support badge to 1', () => {
    expect(handleSocketFrame(frame())).toBe(true);
    expect(badges.get().liveChat).toBe(1);
  });

  it('the push and the socket frame of the same message count once, whichever arrives first', () => {
    handlePushData({ type: 'live_chat_message', org_id: 'org-1', message_id: 'lcm-1' }, { title: 'Clockyn Support', body: 'Hello from support' });
    handleSocketFrame(frame());
    expect(badges.get().liveChat).toBe(1);
    handleSocketFrame(frame({ message_id: 'lcm-2' }));
    handlePushData({ type: 'live_chat_message', org_id: 'org-1', message_id: 'lcm-2' });
    expect(badges.get().liveChat).toBe(2);
  });

  it('a push alone counts when the socket is not connected', () => {
    setGlobalSocketOpen(false);
    handlePushData({ type: 'live_chat_message', org_id: 'org-1', message_id: 'lcm-5' });
    expect(badges.get().liveChat).toBe(1);
  });

  it('the admin\'s own message (echoed from another device) never counts', () => {
    handleSocketFrame(frame({ sender_type: 'org', sender_id: 'user-1' }));
    expect(badges.get().liveChat).toBe(0);
  });

  it('nothing is counted while the conversation is on screen (it reads the message itself)', () => {
    liveChatSession.setOpen(true);
    handleSocketFrame(frame());
    handlePushData({ type: 'live_chat_message', org_id: 'org-1', message_id: 'lcm-3' });
    expect(badges.get().liveChat).toBe(0);
  });

  it.each([2, 3])('a manager or staff member (role %i) never gets a Support badge', (roleId) => {
    signInTestAdmin({ roleId: roleId as 2 | 3 });
    handleSocketFrame(frame());
    handlePushData({ type: 'live_chat_message', org_id: 'org-1', message_id: 'lcm-4' });
    expect(badges.get().liveChat).toBe(0);
  });
});
