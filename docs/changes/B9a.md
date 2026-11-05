# B9a — Direct (1:1) and group chat, admin + staff/manager

One shared chat engine (message log, list bookkeeping, composer, bubble, realtime hooks) used by both role areas; the role only selects a variant.

## Implemented
| Route | Screen | Notes |
|---|---|---|
| `/admin/chat/direct` (param `userId?`) | `features/chat/screens/AdminDirectChatScreen` -> `DirectChatScreen variant="admin"` | list + staff search + conversation; contact info, in-chat search, delete chat |
| `/staff/chat/direct` (param `userId?`) | `StaffDirectChatScreen` -> `variant="staff"` | admin conversation pinned first, local staff search, plain conversation (back only, as in the product) |
| `/admin/chat/groups` (param `groupId?`) | `AdminGroupChatScreen` -> `GroupChatScreen variant="admin"` | groups, create group (name <= 50 + members), conversation, members, add staff, in-chat search, per-group theme |
| `/staff/chat/groups` (param `groupId?`) | `StaffGroupChatScreen` -> `variant="staff"` | groups the user belongs to, conversation, View Members, Add Staff |

Route files are thin re-exports (`src/app/{admin,staff}/chat/{direct,groups}.tsx`).

Structure (`src/features/chat`, hub excluded): `utils/` (pure: `messageLog` reducer, `chatLists`, `frames`, `format`, `rows`, `chatThemes`, `chatSession`), `hooks/` (`useDirectChatList`, `useGroupChatList`, `useDirectConversation`, `useGroupConversation`, `useChatSearch`, `useStaffDirectory`, `useGroupThemes`, `usePickAttachment`, `useStableUri`), `components/` (`MessageBubble`, `MessageList`, `Composer`, `ChatHeader`, `ConversationRow`, panes, sheets), `screens/`.

Navigation model: phone / tablet = list, and the conversation is the same route pushed with the id param (back returns to the list; notification taps with `userId` / `groupId` open it directly). Desktop web (>= 1100) = master / detail (list left, conversation right; selecting replaces the param so the stack does not grow).

Behaviour covered: text, camera / library photo (`pickImage`), document (`pickDocument`), upload progress, optimistic send, failed marker + Retry / Discard, reconnecting sockets (`useChatSocket` / `useGroupSocket`) with a refetch after every reconnect, date separators (IST), scroll to latest on open (and follow new messages only while at the bottom), in-chat search, image bubbles with locked URIs + `ImageViewer`, "Tap to view" reveal gate, file cards (download via `@/lib/platform/files`), read ticks (single / double), per-conversation unread bookkeeping, chat badge sync, mark-read APIs, role gating, create group, members, add staff, group themes (persisted per group), contact info.

## Fixes applied (v1 -> now)
- Incoming socket message was appended to the open conversation whatever it belonged to -> `directBelongs` / `groupBelongs` guard; other conversations only update the list.
- `read_update` marked every own message read -> 1:1 only when the OPEN peer is the reader (`readAppliesToDirect`); group only for the open group (`readAppliesToGroup`), a 1:1-shaped receipt on the group socket is ignored.
- Group `read_update` used a stale `members` closure (fallback total always 2) -> live member count via ref; payloads without counts trigger a debounced history refresh.
- Group tick used the server `is_read` (always true for own messages) and an off-by-one formula -> own messages are read only when `readCount >= totalMembers` (`total_members` already excludes the sender), also on history load.
- Failed sends were silent forever -> `failed` state, error toast with the server message, Retry and Discard; file / photo sends in groups now have an optimistic bubble with progress (v1 had none) and keep the server timestamp / read state.
- Optimistic ordering used the client clock -> pending messages always sort after confirmed ones; confirmed ones sort by server time.
- REST response and socket echo can both arrive -> one bubble (key kept, no remount, thumbnail never swaps); a history refetch that started before a send cannot drop the new message.
- Sockets never reconnected / `poll_refresh` ignored -> managed sockets with backoff + resync (history, mark-read, lists) on reconnect.
- Open-chat badge drift (global socket counted messages of the open chat) -> the open conversation settles each incoming message (`incrementChatForMessage` then `markChatRead`, net zero, id-deduplicated), zeroes its row and subtracts what it held; list loads re-derive both badge sections from the full server list.
- Group list / badge used `organization_id` -> `org_id` (API layer, used by every list load).
- Unknown incoming sender was labelled "Admin" (staff screen) / mis-created rows -> the list is refetched for an unknown partner.
- `sender_name` was the organisation name -> the user's own name when the session has it (the backend resolves it otherwise).
- Cache hygiene: all keys scoped to user / org (`queryKeys.chat|groupChat`), the staff-search peer cache is user-scoped, no un-suffixed `chatList` key, session memory (revealed images, downloads, open conversation) cleared on sign-out via `registerTeardown`.
- Toasts were invisible inside conversations -> the global `ToastProvider` is used (verified in tests).
- Camera permission refusal was silent -> toast ("Camera permission is required.").
- Delete chat was fire-and-forget -> confirm dialog, failure toast, list updated only on success.
- Contact "Role" mislabelled admins as Staff -> role label from role id (Admin / Manager / Staff).
- Scroll-to-end on every content change broke scrolling up and searching -> follows only near the bottom; "scroll to latest" button when scrolled up.
- Role gating for managers / staff on the ADMIN screens (admin conversations only) now also applies to the search fallback.
- Cached list hidden behind a spinner (emp group chat) -> the react-query cache shows instantly while refreshing.
- Duplicate first list fetch (focus + init), stale-closure hardware-back handlers, `LoadingModal` flash, unreachable validation toasts, empty long-press menu (now Copy / Download).

## Deferred (kept v1 behaviour, needs a decision)
- Any group member may add staff (no admin check) — kept; confirm server authorisation.
- Staff / manager direct screen has no menu (contact / search / delete) because the product spec has none; admin-only features stay admin-only.
- Managers / staff reaching the admin screens see admin conversations only (v1 gating), staff screens let them chat with any colleague (admin pinned).
- Plan gating stays on the chat hub (B9b); a deep link to a conversation of a plan-blocked organisation shows the server's 403 message on the list instead.
- Sender-prefixed preview and "n members" copy, theme palettes and the 8-theme list are v1 verbatim.

## Dead / not ported (logged as requested)
Direct chat: pin chat, mute, chat theme (all in-memory only), the Media / Links / Docs sheet with `pickMedia` / `pickDocument` / `addLink` / `resolveFileUrl` / `filterSearchableStaff`, the TEST button (`/test_upload`), the unreachable "No staff found" row, the duplicate `fullStaff` / `allStaff` state. Group chat: Mute Notifications, Admin Only Messages and Delete Chat stubs (toast-only / local-only), the unreachable create-validation toasts and `LoadingModal`. Staff screens: logo state, orphan style files, `emp_home_loading` flag, `listWsRef`. Group theme persistence IS ported (spec marks it live: `STORAGE_KEYS.groupThemes`, scoped to the user).

## Backend needs
| Endpoint | Current | Needed | Impact |
|---|---|---|---|
| WS `read_update` (group) | documented as `{reader_id, group_id}` only | add `message_id`, `read_count`, `total_members` (v1 code expected them) | without counts the client refetches the history to refresh ticks |
| `GET /group-chat/messages` `total_members` | "active members minus one"; v1 compared `read_count >= total_members - 1` | confirm semantics (client now uses `>= total_members`) | wrong ticks if the field includes the sender |
| `GET /chat/list`, `/group-chat/list` plan block | HTTP 500 wrapping `"403: ..."` | real 403 | client already unwraps; only the error status differs |
| `POST /group-chat/add-members` | no WS event is emitted | emit an event so other members' lists / counts refresh | counts are updated locally for the actor only |
| `DELETE /chat/delete/{me}/{other}` | per-user or both sides unknown | confirm | copy says "This cannot be undone" |
| `/auth/push-token/{id}` | not routed (404) | none (backend resolves tokens on send) | `getReceiverPushToken` is no longer called by the client |
| Chat timestamps | assumed UTC when they carry no zone | confirm | wrong times / day separators otherwise |
| `delivered` WS event | consumed if sent (flag only; ticks ignore it per spec) | none | — |
| Group send for non-members | HTTP 500 wrapping 403 | real 403 | message shown to the user is the server text |

## Deviations from spec
- List previews and member counts use icons (image / file / paperclip / users) instead of emoji glyphs; copy otherwise verbatim.
- Conversation is a route (`userId` / `groupId` param) instead of an in-screen view switch; Android hardware back = router back; desktop gets a split view.
- Menus / pickers are `BottomSheet`s (centred dialog on wide web) instead of popups / full-screen modals; delete uses `useConfirm`.
- Attachment menu offers Photo library (live `pickImage` source) next to Document; the camera button stays separate.
- File taps download + open through `@/lib/platform/files` (share sheet / browser download); the Google-Docs WebView viewer is not ported (native-only dependency). Video tile opens the URL externally.
- Group menu entry "View Contact" is labelled "View Members" (it shows the members); group theme only changes the conversation background, bubbles and composer (header follows the app theme).
- Staff / group pickers and local search skip inactive staff; unread badge caps at 99+; rows move to the top on new activity; read tick uses the accent colour; `Today` / `Yesterday` / `D Month YYYY` separators and bubble times are IST (device zone in v1).
- Admin conversation autofocuses the composer (v1 admin only); on native, Enter sends (`submitBehavior="submit"`), on web Enter sends and Shift+Enter inserts a line.
- No bottom tab bar inside chat screens (the app shell provides navigation).

## Known gaps
- Not exercised on a device / emulator; web: route bundling verified (`expo export --platform web`) and jest smoke tests only.
- History is loaded in one request (the API has no paging); very long conversations render through a plain `FlatList`.
- No inline video playback, no message reply / delete actions (none in the product).
- Per-conversation mute / pin / theme for 1:1 chats do not exist (dead in v1).
- A message that is confirmed by the server but whose id is missing in the response is kept under its client id until the next history refresh.

## Shared-code changes
None. (Feature-local helpers only; `STORAGE_KEYS.groupThemes` and `queryKeys.chat|groupChat` already existed.)

## Tests
`src/features/chat/utils/__tests__` (message log / state machine, list bookkeeping, frames, formatting, themes), `components/__tests__/MessageBubble.test.tsx`, `__tests__/directChat.test.tsx` and `__tests__/groupChat.test.tsx` (smoke + core interactions for list and conversation, admin and staff variants). `npx jest src/features/chat`, `npx tsc --noEmit`, `npx eslint src/features/chat`, `npm run check:brand`, `npm run check:routes` all clean for these files.
