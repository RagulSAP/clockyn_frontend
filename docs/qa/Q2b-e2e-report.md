# Q2b - E2E report: admin group chat, announcements, CRM

Scope: chat hub, admin group chat (+ staff side), announcements (admin compose / history, staff feeds), admin CRM (hub, View / Assign, Enter / Edit).
Harness: Playwright on the web export against the stateful mock (`e2e/README.md`). Isolation env used: `E2E_ARTIFACTS=e2e/.artifacts-q2b MOCK_PORT=8805 E2E_WEB_PORT=8850 E2E_WEB_PORTS=4 E2E_WORKERS=4`.

**Result (final run, run once after the last fix): 95 tests x 2 projects (desktop 1280x800, phone 390x844) = 190 passed, 0 failed, 0 flaky.**
`npx tsc --noEmit` 0 errors, `npm run e2e:typecheck` clean, `npm run check:brand` passes, eslint clean on touched files, `npx jest src/features/{chat,announcements,crm}` 233/233 (1 new test).

## Journeys -> spec -> result

| Journey | Spec | Result |
|---|---|---|
| Chat hub: four cards, group badge on card + Chat tab, live direct badge, badge follows read groups, expired plan -> gate panel + renew action, no chat/group request is made, deep link to the list of a blocked org shows the server message + Retry | `q2b-group-chat.spec.ts` (chat hub) 4 | pass |
| Group list: previews, member counts, unread (accessible name), newest-first order, `org_id` (not `organization_id`) on the list request, search + empty state, list error + Retry, `group_created` push | `q2b-group-chat.spec.ts` (group list) 4 | pass |
| Create group: disabled until name + member, 50-char cap, chips, search, inactive staff hidden, payload (trimmed, creator + members, `org_id`), toast, new group opens, failure keeps the sheet + data, draft discarded on close | (create group) 4 | pass |
| Conversation: history + sender names, send text (optimistic, payload, single tick, no echo duplicate, list preview/order), Enter / Shift+Enter, failure toast + Retry + Discard via `failNext`, image + file multipart (+ upload failure), read ticks (`readCount >= totalMembers`; REST path with 1..4 readers and frame path; other-group and 1:1-shaped receipts ignored), IST date separators, scroll-to-latest, members sheet, add staff (success + error toasts visible inside the conversation), in-chat search, unknown group error | (group conversation) 14 | pass |
| Realtime: push into the OPEN group appends once + marks read, push for another group updates only its row/unread, unread clears on open (server + list + hub), socket drop -> reconnect, message posted during the outage recovered by resync | (realtime) 4 | pass |
| Staff group chat: only member groups, no create button, send / live receive, menu without admin-only entries, `org_id` | (staff side) 1 | pass |
| Announcements - ALL: validation / counters / caps, payload, success dialog subtitle (before reset), form reset, auto-close + tap dismiss, failure keeps draft, `success:false` surfaced, double tap sends once | `q2b-announcements.spec.ts` (all staff) 6 | pass |
| Announcements - SELECTED: picker search (name / dept / branch), select-all merges over filtered rows and toggles only visible ones, chips, payload ids only, singular/plural subtitle, staff-list failure + Retry | (selected staff) 4 | pass |
| Announcements - BRANCH / DEPARTMENT: pick / deselect, type switch clears the other, payloads (`branch_id` numeric / `dept_id`), subtitle names the branch/dept, history filtered + searched by name + delete, branch-list failure | (branch and department) 4 | pass |
| History: order, pills, search, delete with confirmation (Cancel / success / HTTP 500 / `success:false`), load failure + Retry, empty state | (history) 5 | pass |
| Staff feeds: per-feed counts = server data, opening a feed clears only its count (hub + persisted over reload), search (targeted also by names), per-user seen ids (two accounts, one browser), push increments then heals to the exact count even with a duplicate push, deletion shows on refresh, failed feed keeps the badge | (staff feeds) 6 | pass |
| CRM hub: menu cards + today count, status counts equal the mock data, status filter, Yesterday / Tomorrow / picked date (dd/MM chip, clear), **IST day** (browser clock at 01:30 IST / still previous UTC day), lead detail sheet, Unassigned pill deep link, load error + Retry, refresh, new lead after refresh | `q2b-crm-hub.spec.ts` (hub overview) 8 | pass |
| CFR inbox: card data, approve confirmation text/Cancel, approve (admin id + action, toast, leads refreshed: lead moved to forward date), reject (no confirm), approve failure keeps it pending, submitted-day chips | (carry forward inbox) 5 | pass |
| Layout + plan gate: desktop two columns vs phone tabs; expired / none -> only the lock card, **no `/api/leads*` request**, renew navigates, plan renewed -> card gone, direct visits to View/Assign and Enter Lead show the backend 403 text | (layout, plan gate) 5 | pass |
| View / Assign: today list (one card per lead, completed last + locked), Yesterday / Tomorrow, **multi-assignee lead = ONE card** (`dupLeadRows` mock hook), assign with branch + department filtered employees (server query asserted) and payload, reassign (assignee excluded, PUT), assign failure + **double tap assigns once**, delete (Cancel / 500 / success), deep link `leadId` (+ unknown / completed ids) | `q2b-crm-leads.spec.ts` 7 | pass |
| Edit lead: prefilled incl. required date, **payload keeps `required_date`**, popup + return, clear -> null, dateless lead stays null, unknown id | (edit lead) 2 | pass |
| Enter lead: required-field summary + inline hints, digit-only mobile (incl. formatted paste) + 10-digit rule, create payload (trimmed, picker date), popup, hub shows it unassigned, **double tap saves once**, null date, save failure, category add (auto-select, duplicate/empty rejected), delete (confirm, clears selection), load failure + Retry | (enter lead) 4 | pass |
| Visual: light + dark screenshots of all screens x 2 viewports, no horizontal overflow, control inside viewport, bubble text contrast >= 4.5 (own + incoming, both themes) | `q2b-visual.spec.ts` 9 | pass |

## Defects found and fixed

| # | Sev | Defect | Evidence | Fix | Regression test |
|---|---|---|---|---|---|
| D1 | High | A fast double tap on **Send** (announcements, all four audiences) posted TWO announcements to every recipient (`isPending` only re-renders after the second click) | two `POST /api/announcements` recorded 1 ms apart | `inFlight` ref guard in `AnnouncementsScreen` and `AnnouncementsTargetedScreen` | `q2b-announcements` "double tap on Send sends exactly one announcement" |
| D2 | High | Double tap on an employee's **Assign** in the CRM assign view sent two `POST /api/leads/assign` | two 200 responses 1 ms apart | `assigning` ref guard in `AssignLeadsScreen.handleAssign` | `q2b-crm-leads` "assign failure ... double tap assigns once" |
| D3 | Medium | Mobile input had `maxLength=10` ahead of the digits-only sanitiser, so a formatted paste ("98765 43210") lost its last digit and failed validation (admin Enter Lead and staff Add Lead sheet) | `fill('98765 43210')` -> `987654321` | removed `maxLength` (sanitiser already slices to 10) in `LeadForm` | `q2b-crm-leads` validation test |
| D4 | Medium | Chat badge seed (`useChatBadgeSeed`, mounted on every screen) requested the chat + group unread totals of a plan-blocked organisation, producing HTTP 500s / console errors on every page | `[http] GET /chat/list/... -> 500` on the CRM lock-card page | seed waits for the plan and skips when chat is blocked (`useOrgPlan`); jest case added | `q2b-group-chat` "plan gate ... no chat list is requested"; `useChatBadgeSeed.test.tsx` |
| D5 | Low | Chat hub header (admin + staff) was flush with the screen edge (custom `header` is not padded by `Screen`) | screenshot `chat-hub-light` | `paddingHorizontal: spacing.lg` in `HubHeader` | visual spec |
| D6 | Low | "Select All" in the announcement staff picker: 25 chips pushed the list down to a sliver | screenshot `ann-picker-*` | chip area capped to 112 px and scrollable | visual + picker spec |
| D7 | Low | "Renew Plan" button left-aligned inside a centred lock card (CRM + chat gate) because `Button` is `alignSelf: flex-start` | screenshot `crm-plan-blocked-light` | `alignSelf: 'center'` in `PlanBlockedCard` and `ChatGatePanel` (+ testID `crm-plan-blocked-action`) | plan-gate spec |
| D8 | Low | Category label asterisk was plain text while every other required label uses the danger colour | screenshot `crm-enter-lead-*` | star rendered with `color="danger"` | visual |

Mock backend (additive, `e2e/mock-server`): group `total_members` now excludes the sender like the real backend (it included it, so ticks could never turn double); state flag `dupLeadRows` (`{leadId: userId}`) emits the extra per-assignment row the real `SELECT DISTINCT` returns.
Support: `e2e/support/q2b.ts` (screenshots, tally / date helpers).

## Open decisions / observations (no change made)
- Plan-gate copy for an `expired` plan on the admin chat hub reads "Your free trial has ended. Please subscribe to the Core Plan..." (plan-status derived), while the list endpoints' 403 text says "Your plan has expired..."; two different messages for the same state (copy decision).
- Completing the edit of a lead returns to the screen it was opened from (the list), not the hub (spec text says hub); kept (`backOr`).
- Chat badge on the Chat tab for staff/managers after reading feeds still includes chat + group counts (intended).
- Known/deferred items from B9a/B9b/B10 (carry-forward persistence, any member may add staff, announcement targeting rules) were not changed.

## Screenshots reviewed
`e2e/.artifacts-q2b/screenshots-q2b/{desktop,phone}/*-{light,dark}.png`: chat hub, group list / create / conversation / menu / members, announcement compose / picker / selected / history / targeted, staff broadcast / targeted, CRM hub / lead details / CFR, assign list / assign view, enter lead / category sheet / edit lead, CRM plan-blocked. Reviewed by eye: group conversation (phone light + dark, desktop), hub, create sheet (dark), members (light), announcement picker (light/dark), history (phone), compose (desktop), CRM hub (phone + desktop), CFR (phone), assign list (dark), assign view (phone + desktop dark), enter lead (dark), category sheet, plan-blocked (phone). Remaining files were generated and pass the overflow / viewport probes but were not all inspected individually.

## Coverage gaps (skipped on purpose, time-boxed)
- Not exercised: group theme picker, image viewer in group chat, long-press copy / download, camera capture, staff-side group add-staff, manager role on these screens, a group created while a conversation is open on another device.
- Not exercised: announcement 1000-char warning colour for the message counter (title counter covered), pull-to-refresh (native only), keyboard handling.
- CRM: staff My Leads and staff CFR creation belong to `q3-08`; admin CRM tablet layout (two-column cards, 768-1099 px) and the custom-date picker on the View/Assign list (only on the hub) are not covered; completed-lead lock tested via disabled buttons only; Android hardware back not testable on web.
- Screenshots: one pass only; tablet width not captured; dark mode captured for every screen but only reviewed for chat and CRM hub.
- Plan matrix beyond `expired` / `none` (prime / core / trial) for CRM and chat not iterated.
