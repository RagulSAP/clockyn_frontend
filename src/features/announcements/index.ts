// Public surface of the announcements feature (other features / the app shell import from here only).
export { useAnnouncementUnreadSync } from './hooks/useAnnouncementUnreadSync';
export { useAnnouncementUnread, markBroadcastRead, markTargetedRead, resetUnread } from './seenIds';
export type { AnnouncementFeedKind } from './seenIds';
