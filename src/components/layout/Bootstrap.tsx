import React from 'react';

import { useAnnouncementUnreadSync } from '@/features/announcements';
import { useChatBadgeSeed } from '@/features/chat';
import { useCrmBadgeSync } from '@/features/crm';
import { useGlobalSocket } from '@/lib/realtime/socket';
import { UpdatePrompt } from './bootstrap/UpdatePrompt';
import { useBootstrapTeardown } from './bootstrap/useBootstrapTeardown';
import { useLocationResume } from './bootstrap/useLocationResume';
import { usePushEvents } from './bootstrap/usePushEvents';
import { usePlanStatusRefresh } from './bootstrap/usePlanStatusRefresh';
import { usePushRegistration } from './bootstrap/usePushRegistration';
import { useSessionExpiry } from './bootstrap/useSessionExpiry';
import { useSessionWatcher } from './bootstrap/useSessionWatcher';

/**
 * Runtime systems of the app, mounted once by the root layout (inside the providers, next to the navigator).
 * Everything here is keyed to the REACTIVE auth store — it starts when a session appears (including a login in
 * the same app run), rebinds when the user changes and stops when the session is cleared:
 *
 *  - push: token registration + refresh (start / foreground), foreground messages, notification-tap routing
 *  - session watcher: single-device `check-session` poll for roles 2/3 + FCM `force_logout`
 *  - session expiry: a 401 on a protected request (expired / revoked bearer token) signs out once, toast + welcome screen
 *  - global realtime socket feeding the badge store
 *  - announcement unread sync (staff / managers: seen-ids -> Chat tab badge + hub cards)
 *  - chat unread seed (individual + group totals -> Chat tab badge before the hub is opened)
 *  - plan status freshness (re-read on foreground when older than 5 min: renewals / expiry mid-session)
 *  - app-update check (start / foreground) and its modal
 *  - location resume for field staff (roles 2/3) who are still punched in
 *  - CRM tab badge for managers / staff (unseen leads; see features/crm/seenLeads)
 *  - teardown registered with the auth store for sign-out
 */
export function Bootstrap() {
  useBootstrapTeardown();
  useGlobalSocket();
  useAnnouncementUnreadSync();
  useChatBadgeSeed();
  useSessionWatcher();
  useSessionExpiry();
  usePlanStatusRefresh();
  usePushRegistration();
  usePushEvents();
  useLocationResume();
  useCrmBadgeSync();
  return <UpdatePrompt />;
}
