# B9b — Chat hubs + announcements

## Implemented
| Route | Screen |
|---|---|
| `/admin/chat` (tab root) | `features/chat/screens/hub/AdminChatHubScreen` (Individual, Group, Announcement, Branch & Dept; hero card; chat plan gate; unread badges on Individual/Group) |
| `/staff/chat` (tab root) | `features/chat/screens/hub/StaffChatHubScreen` (Individual, Group, Broadcast, Targeted; badges on all four; chat plan gate) |
| `/admin/chat/announcements` | `features/announcements/screens/AnnouncementsScreen` (compose to All staff / selected staff with search + select-all picker, history with search + delete; two columns on desktop, Compose/History tabs otherwise) |
| `/admin/chat/announcements-targeted` | `AnnouncementsTargetedScreen` (one branch OR one department, history filtered to branch/dept, search incl. names, delete) |
| `/staff/chat/broadcast` | `BroadcastFeedScreen` (read-only feed of `all`/`selected`, search, pull-to-refresh) |
| `/staff/chat/targeted` | `TargetedFeedScreen` (read-only feed of `branch`/`dept`, search incl. names) |

Other files: `features/announcements/seenIds.ts` (per-user seen ids + unread counters + `markBroadcastRead/markTargetedRead`), `targets.ts` (audience -> payload mapping, validation, labels, select-all, search, tags), `hooks/` (`useEmployeeAnnouncements`, `useAnnouncementUnreadSync`, admin query/mutation hooks), `components/` (card, feed, history, picker, success dialog, layout), `index.ts` (public: `useAnnouncementUnreadSync`, `useAnnouncementUnread`, `markBroadcastRead`, `markTargetedRead`, `resetUnread`). Hub: `hubLogic.ts` (menus, badge mapping, `decideChatGate`), `hooks/useChatHub.ts`, `components/`. Route files are thin re-exports. Tests: `announcements/__tests__/{seenIds,targets}.test.ts`, `adminScreens.test.tsx`, `feedScreens.test.tsx`, `hub/__tests__/{hubLogic.test.ts,hubScreens.test.tsx}` (58 tests).

## Seen-ids / unread design (announcement badge)
- Storage: `STORAGE_KEYS.announcementSeenBroadcast|Targeted` scoped with `storageKeyFor(key, userId)`; already listed in `SESSION_SCOPED_KEYS` so sign-out wipes them (v1: device-global, never cleared). List capped to the newest 500 ids.
- Classification (single source of truth): list-derived `filterBroadcast` (`all|selected`) / `filterTargeted` (`branch|dept`) from `@/api/announcements`. Unread = items whose id is not in the user's seen list of that class.
- Opening a feed calls `markBroadcastRead/markTargetedRead(userId, listOnScreen)`: ids come from the already fetched list (no second GET => no mark race), MERGED into storage; only after a successful load (a failed load never resets the badge). The effect also re-runs after every successful refetch while the feed is open (live refresh when the realtime layer invalidates `queryKeys.announcements.mine`).
- Counters: per-feed zustand store (`useAnnouncementUnread`) drives the hub cards; the sum is pushed to `@/store/badges` (`announcements`, Chat tab badge).
- **One mapping, no double counting**: the foundation realtime layer already unified WS and foreground push (`classifyAnnouncementTarget`: `all|selected|broadcast` -> broadcast, else targeted) and both call the same sink (`badges.increment('announcements')` + invalidate `mine`). That increment is only an optimistic estimate: `useAnnouncementUnreadSync` recomputes the exact counts from the list after EVERY successful fetch (`dataUpdatedAt`), so a push + socket double increment is healed immediately. Also refetches on `socket_reconnected`.
- Admins (role 1) have no announcement query/badge.

## Fixes applied (v1 -> now)
- Success dialog subtitle always showed the fallback ("All staff notified" / "Branch staff notified"): subtitle is computed from the draft BEFORE the form resets (`successSubtitle`).
- Success-dialog timer never cleared / closed a second dialog early: timer restarted per show, cleared on unmount.
- History count pill only after opening History: history loads on mount (react-query), refetched on every tab entry and after send/delete.
- History not refreshed after send: send invalidates the list.
- Delete `success:false`, history/branch/dept/staff load failures were silent: error toasts / `ErrorState` with retry everywhere; `success:false` surfaces the server message.
- Select All replaced the selection with the filtered set and showed the total: now merges over the visible rows (keeps picks outside the filter, pressing again removes only visible), label shows the filtered count.
- Branch/department could not be deselected: tapping again deselects.
- Admin history showed "All Staff" for branch/dept entries: shows the branch/department name.
- Seen ids device-global / overwritten / race / reset on failure: see above. Staff feeds: error state, pull-to-refresh, focus refetch, live refresh (v1: none), trimmed search, `String` ids (no `.split` on numbers), no unused state.
- Hub: v1 flashed the menu before the plan check (a blocked org could tap a card) -> skeleton while the plan loads; plan result no longer cached forever (react-query 5 min + invalidation); chat unread sync keeps the previous counts on error (v1 wrote 0); preload of lists/staff dropped (react-query cache replaces GlobalCache); dead "coming soon"/SOON branch, unused timer, unused styles not ported; hub opened twice-fetch race gone.
- FCM vs WS announcement mapping inconsistency: unified (see above).

## Deferred (v1 behaviour kept)
- Announcement targeting rules (who the server delivers to; admin picker lists all role 2/3 users incl. inactive, as v1).
- Chat plan gate only on the hubs (v1). The child routes (direct, groups, announcements, feeds) are NOT individually gated; recommended: a layout-level gate in `src/app/{admin,staff}/chat` (spec §13 "gate centrally") — not done because it touches another builder's route group.
- Plan matrix (chat only blocks expired / no plan), wording of block messages.
- Individual/group preload of group list + staff list into caches was not ported (screens fetch via react-query; see Known gaps).

## Backend needs
| Endpoint | Current | Needed | Impact |
|---|---|---|---|
| WS/push `announcement` event | no announcement id in the payload | include `announcement_id` + `target` | would allow exact de-dup of push vs socket (currently healed by refetch) |
| `GET /api/announcements/employee/{uid}` | recipient filtering/ordering unverified; `id` type unverified | confirm only own all/selected/branch/dept items, newest first | feeds render server order |
| `GET /api/announcements/{org}` | list scoped to org (maybe all admins) | confirm | delete is irreversible and ungated |
| `/chat/list`, `/group-chat/list` | 500-wrapping-403 on plan block | real 403 | hub badges would stay silent anyway |

## Deviations from spec
- Hub title falls back to "Chat" when the org name is empty (v1 rendered an empty title).
- Admin hero tiles use solid surface tiles on the gradient (theme tokens only).
- Picker "Done" is always enabled (secondary style with 0 selected) = v1 behaviour; picker is a centred dialog/sheet instead of a full-screen modal.
- Card accent colours are theme tokens hashed from the id (same `sum(charCodes) % 8` rule) instead of raw hex.
- Counters use own "n/100" text (warning colour above 80 / 900) instead of `TextField.showCounter`.

## Known gaps
- `npx expo export --platform web` not run: other builders' routes currently fail to resolve (missing feature modules), so a bundle cannot succeed yet; typecheck/lint/tests of my files are clean.
- Hardware-back/`useFocusEffect` per-screen handlers not needed (tab root; Stack back default).
- Chat unread seeding at app start (before the hub is opened) is not done here: individual/group counts load when the hub is visited (and via the global socket afterwards). Announcement counts load at bootstrap.
- Group/staff list prefetch (v1 hub) not ported; B9a's screens should fetch with their own queries.

## Shared-code changes
- `src/components/layout/Bootstrap.tsx`: additive — mounts `useAnnouncementUnreadSync()` (imported from `@/features/announcements`) so the Chat tab badge and hub cards are correct for staff/managers before the hub is opened. No other shared code touched.
