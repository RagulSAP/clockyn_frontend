# Q4d-D - spec conformance audit: employee communications (staff / manager)

Specs: `<spec-root>/pages/10_employee_comms/{emp_chat, emp_personal_chat, emp_group_chat, emp_broadcast, emp_broadcast_targeted}.md`
plus `shared/components/ChatMessageBubble.md`, `shared/api/{chat,group_chat}.md`.
Implementation audited: `src/features/chat/**`, `src/features/announcements/**`, `src/api/{chat,groupChat,announcements}.ts`,
`src/lib/realtime/**`, `src/lib/platform/notificationRouting.ts` (deep links), `src/app/staff/chat/*`, `src/config/routes.ts`.
Known deviations are taken from `docs/changes/B9a.md` and `B9b.md` (cited as B9a / B9b) and `docs/FIX_POLICY.md` (FP).

## Totals

| Status | Count |
|---|---|
| PASS | 116 (incl. rows marked PASS / DEVIATION-OK) |
| DEVIATION-OK | 23 |
| GAP-fixed | 2 |
| Needs-decision | 7 items (section below) |
| Open BUG | 0 |

Baseline before this audit: 15 suites / 193 tests green. After: all green (see Verification).

## GAPs found and fixed

1. **emp_chat: company logo missing in the staff hub header** (spec 3.1 header: logo if known, else chat icon; v1 read the cached company logo). The staff hub always rendered the icon. Fix: `useStaffOrgLogo()` in `src/features/chat/screens/hub/hooks/useChatHub.ts` (same cache entry as the staff home logo, `queryKeys.company.logo(orgId)`, silent on failure), wired in `StaffChatHubScreen.tsx`. Tests: two cases in `hub/__tests__/hubScreens.test.tsx` (icon without logo, logo when present).
2. **emp_chat / badges: Chat tab badge not seeded at app start** (spec F1 B / systems spec: the chat badge services fetch on first subscription at app start; B9b "Known gaps" admitted individual/group counts only loaded after visiting the hub, so a user who restarts with unread messages saw no badge). Fix: `useChatBadgeSeed()` (`src/features/chat/hooks/useChatBadgeSeed.ts`, exported by new `src/features/chat/index.ts`), mounted in `src/components/layout/Bootstrap.tsx` (additive, 2 lines). It shares the hub's query keys (no extra request when the hub opens), is silent on failure (plan-blocked org keeps previous counts) and is healed on socket reconnect because the global socket already invalidates `queryKeys.chat.all/groupChat.all`. Tests: `src/features/chat/hooks/__tests__/useChatBadgeSeed.test.tsx` (seed, failure keeps counts, no session).
   NOTE: another engineer appeared to be adding a `useChatBadgeSync` to Bootstrap at the same time (the file `bootstrap/useChatBadgeSync.ts` did not exist when I finished and Bootstrap did not import it). If it lands, both write the same absolute totals; one of the two should be dropped.

Extra test added (no code change needed): staff notification-tap deep link (`userId` param) opens the admin conversation although no chat exists yet and names the header from the org admin (`directChat.test.tsx`, "a notification tap ...").

## 1. emp_chat (hub) - `src/features/chat/screens/hub/StaffChatHubScreen.tsx`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 header "Chat" / "Team Communication", eyebrow "Choose a channel", 4 cards in order Individual, Group, Broadcast, Targeted | PASS | StaffChatHubScreen.tsx:28,42-48; hubLogic.ts:32-37; hubScreens.test "shows the four channels" |
| Card titles/descriptions verbatim (Individual Chat / One-to-one conversation ... Targeted Announcement / Branch / Department) | PASS | hubLogic.ts:33-36 |
| 14.2 Individual badge = server unread total re-synced on focus; Group badge = group unread total | PASS | useChatHub.ts:32-60 (`useRefreshOnFocus`, org_id scoped totals via api/chat.ts:133, api/groupChat.ts:95) |
| 14.3 badge `99+` over 99, none at 0 | PASS | HubMenuCard.tsx (`CountBadge`, label 99+), hubLogic.ts:42-46; admin hub test asserts "99+" |
| 14.4 WS group message increments Group badge live | PASS | realtime/events.ts:56-91 -> globalRealtime badgeSink -> store -> `useHubCounts` (useChatHub.ts:63-68); events.test |
| 14.5 Broadcast/Targeted badge = unseen count; cleared after opening the feed | PASS | announcements/seenIds.ts:134-162; feedScreens.test |
| 14.6 uncached plan: spinner then blocked card "Chat Unavailable / Your plan has expired. Please contact your admin.", no cards, no buttons | PASS | hubLogic.ts:63-75; StaffChatHubScreen.tsx:29-38 (skeleton instead of spinner = DEVIATION-OK below); test "plan-blocked" |
| 14.7 cached plan: no spinner / no plan call on later focus | PASS | useOrgPlan.ts (react-query, 5 min stale, `isLoading` only on first load) |
| 14.8 plan call fails -> menu shown (fail open) | PASS | config/plans.ts:55 (`!status` -> false); hubLogic.ts:65 |
| 14.9 free trial never blocked | PASS | config/plans `isPlanFeatureBlocked` (foundation, matrix unchanged per FP A) |
| 14.10 card taps go to personal / group / broadcast / targeted and back returns to hub | PASS | hubLogic.ts routes; `router.push` in StaffChatHubScreen.tsx:47; test asserts the four routes |
| 14.11 header back / hardware back = back one screen | DEVIATION-OK | hub is a tab root (`hideBack`), shell handles back; B9b "Known gaps" (no per-screen handlers) |
| 14.12 cached company logo in header else chat icon | GAP-fixed | see GAP 1 |
| 14.13 mount prefetch of groups + staff into caches; failures silent | DEVIATION-OK | B9b Deferred: GlobalCache preload replaced by react-query (screens fetch themselves, cached 5 min); not user-visible |
| 14.14 individual list opens instantly from cache | DEVIATION-OK | react-query cache (`useDirectChatList`) shows cached list immediately, then refetches |
| Menu flash before plan check (v1 defect 10) | PASS | skeleton while `isLoading` (StaffChatHubScreen.tsx:29), test "does not flash the menu" (admin) |
| Blocked card has no action for staff | PASS | StaffChatHubScreen.tsx:38 `cta={null}`; test asserts no `chat-gate-cta` |
| Plan cache never invalidated after renewal (v1 defect) | PASS | react-query staleTime + invalidation (B9b) |
| Dead "SOON"/coming-soon branch | PASS (not ported, FP B7) | - |
| 8 copy table | PASS | all strings present; "Loading" spinner has no text in spec |
| Spinner during plan check | DEVIATION-OK | `Skeleton` x4 instead of spinner (design-system policy, BUILDER_BRIEF 3) |

## 2. emp_personal_chat (staff direct chat) - `DirectChatScreen variant="staff"`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 cached list shown at once, refreshed in background | PASS | useDirectChatList.ts:45-53 (react-query cache + `useRefreshOnFocus`) |
| 14.2 no cache: loading indicator; failure -> list stays empty with "No chats yet" (+ admin card if known) | PASS | DirectListPane.tsx:68-87; staff `contacts` still contains the synthesised admin on error (useDirectChatList.ts:79-84). "Loading chats…" text replaced by `SkeletonList`, failure additionally shows ErrorState when nothing at all is known = FP B2 (DEVIATION-OK) |
| 14.3 org admin first even without messages; existing admin entry moved to top | PASS | chatLists.ts:131-136 `mergeAdminFirst`; test "pins the admin conversation first" |
| 14.4 search: list filters by name/role/dept (NOT branch); dropdown lists staff with name, branch, dept, role + "New" pill for people without a chat | PASS | DirectListPane.tsx:26-31 (`matchBranch: variant==='admin'`), :47-64; chatLists.ts:146-165; test "searches the staff directory locally" |
| Search placeholder `Search by name, branch, department…`, subline `role · dept · branch`, role labels Admin/Manager/Staff from role id | PASS | DirectListPane.tsx:47,56; chatLists.ts:82-87 |
| Local search, no debounce, no role filter, self excluded, admin searchable | PASS | useChatSearch.ts:25-58 (staff: debounce 0, local pool incl. admin), chatLists.ts:158-165 |
| Inactive staff excluded from search | DEVIATION-OK | B9a Deviations ("pickers and local search skip inactive staff") |
| 14.5 tap search result opens conversation, search clears | PASS | DirectListPane.tsx:33-40 |
| 14.6 open chat with 3 unread: badge disappears, hub drops by 3, history oldest->newest, mark-read sent | PASS | useDirectConversation.ts:152-163 (zero row, `markChatRead('individual', previous)`, `markChatRead(peer, me)` per api/chat.ts:197); messageLog.ts:113-128 ordering; directChat.test "loads history ..." |
| Opening an EXISTING chat via search with unread (v1 quirk: badge not decremented) | PASS (fixed vs v1) | unread is read from the cached list row at open, not from the synthesised search item (useDirectConversation.ts:155) |
| 14.7 history API fails -> empty conversation without error message | DEVIATION-OK | error state with Retry (FP B2 "no silent failures"), MessageList.tsx:122-124 |
| 14.8 send "hello": bubble at once with single tick, preview updates, exactly one bubble after response/echo | PASS | useDirectConversation.ts:264-274, messageLog.ts:205-239; test "sends optimistically, then shows the server message exactly once" |
| 14.9 send fails: v1 bubble stays silently | DEVIATION-OK | failed marker + toast + Retry/Discard (spec 13 fix 2; FP B2); test "a failed send ..." |
| 14.10 attach file: optimistic bubble, spinner, camera+attach disabled; success gets server URL; failure undelivered | PASS | Composer.tsx:70-78 (camera disabled, attach shows Spinner), useDirectConversation.ts:276-292,319; failure = failed/Retry (DEVIATION-OK as above) |
| 14.11 camera permission denied | DEVIATION-OK | toast instead of silent (FP B2; B9a) |
| 14.12 photo uploaded as image, preview "Photo" | PASS | usePickAttachment.ts:23-31, format.ts:64-75 (icon instead of emoji = B9a deviation) |
| 14.13 incoming message in open chat: appended at bottom, scrolls, marked read | PASS | useDirectConversation.ts:196-214, MessageList.tsx:51-63; test "only appends incoming messages of THIS conversation" |
| 14.14 incoming while on list: card badge + preview/time update, hub badge +1 once (no double count) | PASS | useDirectChatList.ts:59-77, chatLists.ts:36-57, badges store id de-dup (store/badges.ts:130+) |
| 14.15 message from someone not in my list -> new card at top with unread 1 | DEVIATION-OK | list is refetched for an unknown partner (real name/role) instead of inventing an "Admin" row (spec 13 fix 4); chatLists.ts:36-45 |
| 14.16 `read_update` -> double tick | PASS | frames.ts `readAppliesToDirect` (scoped fix, spec 13 fix 3), messageLog.ts:241; test "read receipts only mark my messages when the open peer is the reader" |
| 14.17 header back in conversation -> list (no app navigation) + list refreshed; on list back leaves | DEVIATION-OK | conversation is a route (`userId` param); `router.backOr`, list refetches on focus (B9a Deviations) |
| 14.18 WS drop: v1 no updates; v2 must reconnect + resync | PASS | socketCore.ts:83-227 (backoff reconnect, foreground reconnect), `onReconnect` refetch list/history + mark-read (useDirectChatList.ts:77, useDirectConversation.ts:228-233), global socket invalidates chat caches (socket.ts:44-66); socketCore.test |
| 14.19 any staff can chat with any colleague (no role filter) | PASS | useChatSearch.ts:25-30 (`adminOnly` only for the ADMIN screens used by non-admins) |
| Empty/whitespace message ignored; no max length | PASS | Composer.tsx:33-38, useDirectConversation.ts:266-267 |
| Optimistic ids / echo reconciliation, dedupe by id, items without id dropped, duplicate ids | PASS | messageLog.ts:120-128,226-239 (client ids `c...` replace the `m`/`t` convention, spec 13 fix 9) |
| Message type resolution (image stays image; derive from extension) | PASS | format.ts:26-36 |
| List preview rules (image/file by type then extension, `http` + `/` -> Attachment) | PASS | format.ts:57-70 |
| formatTime list (Just now / Nm ago / Nh ago / Yesterday / short date) | PASS | format.ts:73-75 -> datetime `formatRelativeTime(hoursAgo)` |
| Bubble time IST HH:MM | DEVIATION-OK | B9a: IST via `@/lib/datetime` instead of device zone (FP B1) |
| Avatar colour hash / stable photo uri | PASS | `Avatar` + `stableImageKey` (design system) |
| No date separators / contact sheet / menu in v1 staff conversation | DEVIATION-OK | separators added for both roles (B9a); staff has no menu (`full` flag, DirectConversationPane.tsx:38-39,100-110) as spec 13 table |
| Dead reconnect / ignored poll_refresh (spec 13 fix 1) | PASS | replaced by managed sockets (see 14.18); 4 s `poll_refresh` fallback intentionally not ported (see Needs decision 6) |
| Swallowed send failures (fix 2), `read_update` scoping (3), unknown sender (4), sender_name = org name (5), unscoped `chatList` cache write (7), `getAllStaff` param naming (8) | PASS | B9a Fixes; `sender_name` = session name (useDirectConversation.ts:126); keys `queryKeys.chat.*` scoped to user/org |
| Deep link: notification tap -> `/staff/chat/direct?userId=` (admin screens for role 1) | PASS | notificationRouting.ts:84-91 (session role wins, `sender_id`/`from_user_id`/`sender_user_id`), DirectChatScreen.tsx:25-27; peer lookup falls back to org admin (useDirectConversation.ts:56-58); new test |
| Unread/read-state on open: zero row, subtract held count, mark-read, settle incoming of the open chat (net zero, id-deduped) | PASS | useDirectConversation.ts:152-163,202-208 |
| `/chat/list` org_id, mark-read argument order (sender = other, receiver = me) | PASS | api/chat.ts:127-130,197-200 |
| `getReceiverPushToken` before every send | DEVIATION-OK | not called (route does not exist, backend resolves token; B9a Backend needs) |
| Copy: Individual Chat, No chats yet, No matching chats, Search for someone to start chatting, Type a message..., New, Admin/Manager/Staff | PASS | DirectChatScreen.tsx:61; DirectListPane.tsx:42,47,58,85; Composer.tsx:81 |
| Copy: `Loading chats…`, `Loading messages...` | DEVIATION-OK | skeletons |
| Emoji previews (camera / file / clip glyphs) | DEVIATION-OK | icons + words "Photo / File / Attachment" (B9a) |

## 3. emp_group_chat (staff group chat) - `GroupChatScreen variant="staff"`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 3 groups -> 3 cards: name, `Sender: preview` or "Tap to start chatting", time, member count | PASS | GroupListPane.tsx:49-71, ConversationRow.tsx; test "lists only the groups returned for the user" (list = server list of groups the user belongs to, `org_id` param) |
| 14.2 no groups: "No groups yet / You'll see groups here when added by admin", no create button | PASS | GroupListPane.tsx:57-60 (`admin && onCreate`), GroupChatScreen.tsx:33-36 (createButton/sheet admin only); same test |
| 14.3 search groups by name, case-insensitive; no match -> empty state | PASS | chatLists.ts:205-207, GroupListPane.tsx:20 |
| 14.4 open group with 4 unread: badge clears, hub Group badge -4, history + members load, mark-read | PASS | useGroupConversation.ts:98-110, queries :70-86 |
| 14.5 message from member in open group: appended with sender name, scroll, marked read | PASS | useGroupConversation.ts:115-127 (`groupBelongs` guard), MessageBubble.tsx:60-64; test "only appends messages of THIS group" |
| 14.6 message for another group: card unread +1, preview/sender/time update, hub badge +1 once | PASS | useGroupChatList.ts:46-77, chatLists.ts:170-188, store id de-dup |
| 14.7 admin creates group including me -> list reloads | PASS | `group_created` -> invalidate list (useGroupChatList.ts:48-52) |
| 14.8 send "hi": one bubble after echo/response | PASS | useGroupConversation.ts:155-199, messageLog.ts (single bubble, key kept) |
| 14.9 send fails: v1 silent | DEVIATION-OK | failed marker + toast + Retry (spec 13 fix 6; FP B2) |
| 14.10 attach file: spinner, camera+attach disabled, bubble on success | PASS (better) | optimistic bubble with progress in groups (v1 had none) - spec 13 fix 6 |
| 14.11 camera permission denied | DEVIATION-OK | toast |
| 14.12 members sheet: Admin pill, dept, branch, role, "You" for me, `{n} members`, "No members found" | PASS | MembersSheet.tsx:25-78 |
| 14.13 Add Staff: excludes self + members; search name/dept/branch; no Add button with 0 selected; fallback "Staff"; "All staff are already members" | PASS | chatLists.ts:210-218, AddStaffSheet.tsx:34-65, StaffPickerList.tsx:73-75; test "adds staff who are not members yet" |
| 14.14 add 2 staff: added, sheet closes, count updates, toast "2 staff added!" visible in conversation | PASS | useGroupConversation.ts:244-258 (member count + list count updated, spec 13 QA note fixed); toast host global |
| 14.15 add fails: toast "Failed to add staff", sheet stays open | PASS | useGroupConversation.ts:254-257, AddStaffSheet.tsx:41-46 (server detail shown when present, FP B2); test "a failed add" |
| 14.16 header back in conversation -> list; list back -> previous screen | DEVIATION-OK | route-based (`groupId` param, B9a) |
| 14.17 Android back on list -> `/emp_chat` replace + `emp_home_loading` flag | DEVIATION-OK / not ported | flag is dead (spec 13 fix 8, FP B7); plain back |
| 14.18 `read_update` with `read_count >= total_members-1` -> read tick | DEVIATION-OK | `readCount >= totalMembers` because `total_members` already excludes the sender (B9a Fixes; Backend needs row 2); messageLog.ts:19-22,250-257 |
| Group list: unread raw number, no 99+ cap in v1 | DEVIATION-OK | capped at 99+ (spec 13 fix 11) |
| Staff cannot create / rename / delete / mute / theme groups | PASS | menu = View Members + Add Staff only (GroupConversationPane.tsx:34-46), themes admin only (:33) |
| Cached list hidden behind spinner (fix 2) | PASS | GroupListPane.tsx:36 (`isLoading && groups.length === 0`) |
| `members` stale closure for `total_members` fallback (fix 3) | PASS | `membersRef` + `fallbackTotal` (useGroupConversation.ts:87,132-138) |
| Reconnect leak / once only (fix 4) | PASS | managed sockets + `onReconnect` refetch (useGroupConversation.ts:148-153) |
| Own text echo forced `is_read:true` (fix 5) | PASS | `chatItemFromGroup` (messageLog.ts:58) |
| Open-group messages unsorted / not deduped (fix 9) | PASS | `normalizeItems` |
| Any member may add staff (fix 10) | Needs-decision #3 | kept v1; B9a Deferred |
| Group send for non-members | PASS | server 403 text surfaced via error toast (B9a Backend needs) |
| Sub-title `{n} members · Tap to view`, tap -> members sheet | PASS | GroupConversationPane.tsx:57-58 |
| Unknown sender label `Unknown`, self `You` (members sheet) | PASS | MessageBubble.tsx:62 (uses `sender_name` of the message instead of the member lookup; equivalent data), MembersSheet.tsx:49 |
| Empty conversation "No messages yet / Send the first message!" | PASS | MessageList.tsx:128 |
| Header initials tile / `getColor` per-sender name colour / default bubble colours | DEVIATION-OK | design tokens (`Avatar`, `color="primary"` sender label) |
| Staff groups = groups the user belongs to (server filter) | PASS | api/groupChat.ts:88-92 |
| Deep link `?groupId=` (notification tap) | PASS | notificationRouting.ts:92-98; GroupChatScreen.tsx:22-24; useGroupConversation reads the group from the list query |
| Copy: Group Chat, Search groups…, Tap to start chatting, members, No groups yet, View Members, Add Staff, Search staff…, All staff are already members, Add {n} Staff, {n} staff added!, Failed to add staff, No members found, Admin, You, Unknown | PASS | GroupChatScreen.tsx:55,62; GroupListPane.tsx; GroupConversationPane.tsx; AddStaffSheet.tsx; MembersSheet.tsx |
| `Loading messages...` LoadingModal, emoji members glyph | DEVIATION-OK | skeleton, `Icon` |

## 4. emp_broadcast (staff broadcast feed) - `BroadcastFeedScreen`

| Bullet / rule | Status | Evidence |
|---|---|---|
| Feed is read-only for staff (no compose / delete / picker) | PASS | AnnouncementFeed.tsx has no write actions; `onDelete` only passed by admin history |
| 14.1 3 broadcast (2 all + 1 selected) + 1 branch -> exactly the 3 show | PASS | api/announcements.ts:50-52 `filterBroadcast`; seenIds.ts:44-46; feedScreens.test |
| 14.2 pill "All Staff" / "Selected Staff" | PASS | targets.ts:195-204 (`feed:'broadcast'`) |
| 14.3 `by {sent_by}` only when present | PASS | AnnouncementCard.tsx:71-75 |
| 14.4 search title/message case-insensitive; "No results / Try a different search term"; clear restores | PASS | targets.ts:175-182 (query trimmed, fix 7), AnnouncementFeed.tsx:54-58, SearchBar clear |
| 14.5 empty: "No announcements yet / Announcements from your admin will appear here" | PASS | AnnouncementFeed.tsx:15-18,54-58 |
| 14.6 hub Broadcast card + Chat tab badge include unseen; opening clears Broadcast only | PASS | seenIds.ts:134-162 (`markFeedRead`), shellNav.ts:109 (tab badge = chat + announcements) |
| 14.7 re-launch: seen ids persisted, new one counted | PASS | `getJSON/setJSON` per-user keys (seenIds.ts:41-44,95-108) |
| 14.8 WS `announcement` target all -> Broadcast badge +1 immediately, reconciled by refetch | PASS | events.ts:77-78,47-50; globalRealtime.ts:35-43 (optimistic +1 and `mine` invalidate); useAnnouncementUnreadSync.ts:31-34 recompute after every fetch; events.test |
| 14.9 API `success:false` / network failure: badge not reset, no crash | PASS (better) | ErrorState with Retry (FP B2) instead of looking empty; marking only after a successful load (AnnouncementFeed.tsx:36-40); test "a failed load ..." |
| 14.10 back -> hub | PASS | `Screen` back (stack) |
| 14.11 admin (role 1) never counted | PASS | useEmployeeAnnouncements.ts:8-12, globalRealtime.ts:35-39 |
| Redundant second GET / overwrite of seen ids / race (fix 1) | PASS | ids from the displayed list, merged (seenIds.ts:112-126) |
| Seen ids device-global, never cleared (fix 2) | PASS | `storageKeyFor(key, userId)`, wiped on sign-out |
| No live refresh / pull-to-refresh / focus refetch (fix 3) | PASS | AnnouncementFeed.tsx:31-33, useEmployeeAnnouncements.ts staleTime 30 s + `mine` invalidation |
| Error state (fix 4), numeric `id` safe (fix 5) | PASS | mapAnnouncement `str(id)` (api/announcements.ts:34) |
| Order as the server returns, no client sort | PASS | AnnouncementFeed.tsx (no sort) |
| Relative time (Just now / Nm ago / HH:MM / Yesterday / short date) | PASS | AnnouncementCard.tsx:46 -> `formatRelativeTime` (IST, FP B1) |
| Card accent hash `sum(charCodes) % 8`, megaphone tile, full message text | PASS / DEVIATION-OK | targets.ts:211-221 (theme tokens instead of raw hex, B9b) |
| Header "Broadcast", placeholder `Search announcements…` | PASS | AnnouncementFeed.tsx:15,76 |
| Foreground push + socket both count (v1 double count; inverse default mapping) | PASS | unified `classifyAnnouncementTarget` and healed by refetch (B9b) |
| Unknown `target` value | Needs-decision #1b | mapper turns unknown into `all` (api/announcements.ts:20-23, test-locked) so it lands in Broadcast; v1 excluded it from both feeds |
| Notification tap (`announcement` push) opens the home screen, not the feed | PASS | notificationRouting.ts:80-83 (verbatim v1) |

## 5. emp_broadcast_targeted (staff targeted feed) - `TargetedFeedScreen`

| Bullet / rule | Status | Evidence |
|---|---|---|
| 14.1 only `branch` and `dept` show (not `all`) | PASS | `filterTargeted` (api/announcements.ts:55-57); feedScreens.test |
| 14.2 branch pill: building icon + branch name, fallback "Branch" | PASS | targets.ts:190-192 |
| 14.3 dept pill: layers icon + dept name, fallback "Department" | PASS | targets.ts:193-194 |
| 14.4 search matches title, message, branch name, dept name | PASS | targets.ts:175-182 (`withNames` = targeted feed); test "search also matches the branch / department name" |
| 14.5 empty "No announcements yet / Branch or department announcements will appear here" | PASS | AnnouncementFeed.tsx:17 |
| 14.6 2 unseen targeted -> hub Targeted badge 2; cleared after opening; Broadcast badge unaffected | PASS | per-feed seen ids (seenIds.ts:45-47,134-146); hub test counts 7 targeted / 2 broadcast |
| 14.7 WS target `branch` -> Targeted +1, reconciled by refetch | PASS | events.ts:47-50 (anything not all/selected/broadcast = targeted) |
| 14.8 request fails: badge not reset | PASS | as emp_broadcast 14.9 |
| 14.9 back -> hub | PASS | stack back |
| 14.10 `by {sent_by}` only when non-empty; clear button restores | PASS | AnnouncementCard.tsx:71-75, SearchBar |
| Header "Targeted", violet fixed left border, branch vs dept icon | PASS | AnnouncementFeed.tsx:14,69-72 (`statusHalfDay` token) |
| Which branch/department announcements a staff member receives (server-side recipient filtering) | Needs-decision #1 | client does no filtering by the user's own branch/dept, exactly like v1 (spec 6 "UNVERIFIED"; FP C "announcement targeting rules"); B9b Backend needs |

## Cross-cutting: realtime, deep links, rules

| Item | Status | Evidence |
|---|---|---|
| Sockets reconnect with backoff + jitter, ping, foreground reconnect, close on sign-out, rebind on user change | PASS | socketCore.ts:83-227, socket.ts:36-66,72-100; socketCore.test (273 lines) |
| Resync after reconnect (history, lists, mark-read, badge totals, announcements) | PASS | `onReconnect` in the 3 chat hooks; global `invalidateQueries` + `socket_reconnected` bus (socket.ts:56-61) |
| One count per message across global socket, push and open conversation | PASS | globalMessageDeduper + store `registerMessageId` + open-conversation net-zero settle |
| Polling intervals | PASS (n/a) | spec has none besides the dropped 4 s `poll_refresh` fallback (Needs-decision 6) |
| Chat WS frames of other conversations never leak into the open one | PASS | `directBelongs` / `groupBelongs` (messageLog.ts:280-289) |
| Tap targets: `userId` (direct) / `groupId` (group) route params, role from session | PASS | notificationRouting.ts:84-98; routes.ts:124-129; thin route files `src/app/staff/chat/*.tsx`, hub tab `src/app/staff/(tabs)/chat.tsx` |
| Staff vs admin differences honoured (pinned admin, local search w/o branch in list filter, no menu, no create group, no theme, read-only feeds, hub copy/cards, no purchase CTA) | PASS | rows above |
| Message send validation (trim, empty ignored, no max length), optimistic retry/discard | PASS | Composer.tsx, hooks above |
| Attachments (camera, library, document, 60 s upload via `api.upload`, mime fallback, progress) | PASS | usePickAttachment.ts, api/chat.ts:173-191, api/groupChat.ts:134-148 (`resolveMimeType`) |
| Image "Tap to view" gate per session, lightbox/ImageViewer, file card statuses, long-press menu (Copy / Download) | PASS / DEVIATION-OK | MessageBubble.tsx:151-229, :253-311; Google-Docs WebView viewer not ported, empty menu for text replaced by Copy (B9a Deviations, ChatMessageBubble 13) |
| `sender_name` | PASS | session name, not the org name |
| Dates via `@/lib/datetime`, no `Alert.alert`, no `fetch` outside `src/lib/api`, no legacy names | PASS | grep clean; `npm run check:brand` clean for my files |

## Needs decision (no behaviour changed)

1. **Announcement targeting (FP C).** (a) The employee endpoint `/api/announcements/employee/{uid}` decides which branch / department / selected items a staff member receives; the client does not filter by the user's own branch/department (v1 identical, spec 6 "UNVERIFIED"). Evidence: AnnouncementFeed.tsx uses `filterBroadcast/filterTargeted` only. Needs backend confirmation (also ordering and `id` type, B9b Backend needs). (b) `mapAnnouncementTarget` (api/announcements.ts:20-23, locked by `api/__tests__/announcementsLeads.test.ts:61`) maps an unknown/missing `target` to `all`, so such an item would show in Broadcast as "All Staff" and be counted; v1 excluded it from both feeds. Edge case only; decide whether unknown targets should be dropped.
2. **Chat plan gate only on hubs.** Deep links (notification tap, shared URL) to `/staff/chat/direct|groups|broadcast|targeted` of a plan-blocked organisation bypass the hub gate (v1 same, spec personal chat 1). Spec 13 of the hub recommends gating centrally; needs a decision to add a layout-level gate in `src/app/staff/chat` (route group owned elsewhere). The server already returns the plan error on the list calls (shown as an error state).
3. **Any group member may add staff** (no admin check, v1). Confirm server-side authorisation of `POST /group-chat/add-members`.
4. **Staff may chat with every colleague** (no role restriction; admin pinned) and `/chat/list` membership semantics (staff added under a manager are missing from the server list per `shared/api/chat.md` gotcha) - confirm product intent / backend fix.
5. **Backend contract confirmations already logged by B9a/B9b** and re-confirmed by this audit: WS `read_update` for groups lacks `message_id/read_count/total_members` (client refetches the history, debounced); `total_members` semantics (client uses `>= total_members`); `add-members` emits no WS event; plan block = HTTP 500 wrapping 403; announcement WS/push payload lacks id + target.
6. **Socket fallback polling.** v1 emitted a synthetic `poll_refresh` every 4 s while the socket was down (ignored by the staff screens, used only by admin). v2 relies on backoff reconnect + resync. If the backend socket can stay unreachable for long periods (proxies), a visible-screen fallback poll (e.g. 15-30 s list/history refetch while the socket is closed) would be a product decision; not added.
7. **Observation (not a spec item):** a notification deep link into a conversation before the chat list is cached cannot subtract that chat's unread count from the badge at open (count unknown), and a list fetched in the same instant as `mark-read` can still carry it; the next focus/reconnect refresh (and the new start-up seed) corrects it. A server-driven fix (derive counts from the list after mark-read) would need agreement on ordering.

## Files changed

- `src\features\chat\screens\hub\hooks\useChatHub.ts` (+`useStaffOrgLogo`)
- `src\features\chat\screens\hub\StaffChatHubScreen.tsx` (logo)
- `src\features\chat\hooks\useChatBadgeSeed.ts` (new)
- `src\features\chat\index.ts` (new, exports `useChatBadgeSeed`)
- `src\components\layout\Bootstrap.tsx` (shared, additive: mounts `useChatBadgeSeed`; see note on a concurrent `useChatBadgeSync`)
- Tests: `src\features\chat\screens\hub\__tests__\hubScreens.test.tsx` (logo cases, `@/api/auth` mock), `src\features\chat\hooks\__tests__\useChatBadgeSeed.test.tsx` (new), `src\features\chat\__tests__\directChat.test.tsx` (staff deep link)
- Doc: `docs\qa\Q4d-D.md`

## Verification

- `npx jest src/features/chat src/features/announcements src/lib/realtime`: green (193 existing + 4 new tests).
- `npx tsc --noEmit`: clean (whole project).
- `npx eslint src/features/chat src/features/announcements src/lib/realtime src/components/layout/Bootstrap.tsx`: clean.
- `npm run check:routes`: passed. `npm run check:brand`: fails ONLY on `docs/qa/Q4d-C.md` lines 24-27 (another engineer's report quotes legacy-looking tokens); nothing from files touched here.
- Note: chat screen tests now load `@/components/layout` -> `Bootstrap` -> `expo-notifications` (warning, "Jest did not exit" notice); this comes from the layout index exporting `Bootstrap`, not from the changes above.
