# Foundation contracts

Module paths and public exports that feature builders may rely on. Foundation agents implement these **exactly** (they may add exports, never rename/remove). Builders import only from the paths below. If something you need is missing, add it to the owning module in the smallest possible way and note it in your change log.

Alias: `@/` → `src/`.

## 1. Design system — `@/components/ui` (owner: F1)
All components read `useTheme()`; all accept `style`/`testID`; all work on iOS/Android/Web.

| Export | Props (essentials) |
|---|---|
| `Text` | `variant?: TypographyVariant` (default `body`), `color?: keyof ColorTokens | string`, `align?`, `numberOfLines?` + RN Text props |
| `Button` | `title`, `onPress`, `variant?: 'primary'|'secondary'|'ghost'|'danger'|'success'`, `size?: 'sm'|'md'|'lg'`, `loading?`, `disabled?`, `icon?: IconName`, `iconRight?`, `fullWidth?` |
| `IconButton` | `icon: IconName`, `onPress`, `variant?: 'plain'|'tonal'|'filled'`, `size?`, `accessibilityLabel` |
| `Icon` | `name: IconName` (lucide-based, string union), `size?`, `color?` |
| `Card` | `children`, `padding?`, `onPress?`, `variant?: 'default'|'outlined'|'gradient'|'muted'` |
| `TextField` | `label?`, `value`, `onChangeText`, `placeholder?`, `error?`, `hint?`, `leftIcon?`, `rightIcon?`, `secure?`, `keyboardType?`, `maxLength?`, `multiline?`, `required?`, `editable?`, `prefix?` (e.g. +91), `onSubmitEditing?` |
| `OTPInput` | `length?=6`, `value`, `onChange`, `autoFocus?`, `error?` |
| `Select<T>` | `label?`, `value`, `options: {label:string; value:T; subtitle?:string}[]`, `onChange`, `placeholder?`, `searchable?`, `error?`, `disabled?`, `title?` (modal/sheet picker; native-feel on mobile, popover/modal on web) |
| `MultiSelect<T>` | like Select with `values`, `onChange(values)`, `selectAll?` |
| `DateField` | `label?`, `value: string` (`YYYY-MM-DD`), `onChange(value)`, `minDate?`, `maxDate?`, `error?` — web uses native `<input type=date>`; mobile uses the datetimepicker |
| `TimeField` | `value: string` (`HH:mm`), `onChange`, `label?`, `error?` |
| `MonthYearPicker` | `month` (1-12), `year`, `onChange({month,year})`, `yearRange?: [from,to]` |
| `SegmentedControl<T>` | `options`, `value`, `onChange` |
| `Tabs` | `tabs: {key; label; badge?}[]`, `active`, `onChange` (scrollable pill tabs) |
| `Badge` / `StatusPill` | `Badge`: `label`, `tone?: 'neutral'|'primary'|'success'|'warning'|'danger'|'info'`; `StatusPill`: `status: string` (maps pending/approved/rejected/present/absent/late/active/inactive/… to tones) |
| `CountBadge` | `count`, caps at `99+` |
| `Avatar` | `uri?`, `name?`, `size?`, `status?` (online dot) — stable image URI handling |
| `ListItem` | `title`, `subtitle?`, `left?`, `right?`, `onPress?`, `chevron?`, `destructive?`, `divider?` |
| `SectionHeader` | `title`, `action?: {label,onPress}` |
| `StatCard` | `label`, `value`, `icon?`, `tone?`, `onPress?`, `trend?` |
| `SearchBar` | `value`, `onChangeText`, `placeholder?`, `onClear?` |
| `FilterChips<T>` | `options`, `value`, `onChange`, `multiple?` |
| `Switch`, `Checkbox`, `RadioGroup` | standard controlled inputs |
| `EmptyState` | `icon?`, `title`, `message?`, `action?` |
| `ErrorState` | `message`, `onRetry?` |
| `Skeleton`, `SkeletonList` | shimmer placeholders |
| `Spinner` | `size?`, `color?` |
| `LoadingOverlay` | `visible`, `message?` (blocks touches; auto-timeout safety optional) |
| `Modal` | `visible`, `onClose`, `title?`, `children`, `footer?`, `dismissible?`, `size?` (centred dialog; width-capped on web) |
| `BottomSheet` | `visible`, `onClose`, `title?`, `children`, `snap?` (sheet on mobile, centred dialog on wide web) |
| `ConfirmDialog` + `useConfirm()` | `const confirm = useConfirm(); const ok = await confirm({title, message, confirmText?, cancelText?, destructive?})` |
| `ToastProvider` + `useToast()` | `const toast = useToast(); toast.success(msg) / toast.error(msg) / toast.info(msg)`; one global mount (works inside stacks and modals) |
| `Calendar` | month grid: `month`, `year`, `onMonthChange`, `renderDay?`, `markedDates?: Record<YYYY-MM-DD, {color?; label?; dots?}>`, `selectedDates?`, `onDayPress`, `disabledDates?`, `minDate?`, `maxDate?`, `weekStartsOn?` |
| `DataTable<T>` | `columns: {key; title; width?; frozen?; align?; render?(row)}[]`, `rows`, `rowKey`, `headerGroups?`, `frozenColumns?=1`, `onRowPress?`, `loading?`, `emptyText?` — frozen left column, synced scroll |
| `FAB` | `icon`, `onPress`, `label?` |
| `Divider`, `Spacer` | utilities |
| `GradientView` | brand gradient background (`colors?`) |
| `BrandMark` | Clockyn logo mark (SVG) `size`, `variant?: 'mark'|'wordmark'|'stacked'` |
| `ImageViewer` | full-screen zoomable image `uri`, `visible`, `onClose` |
| `PullToRefresh` helpers | `RefreshableScroll`, `RefreshableList` wrappers (RefreshControl; web-safe) |

## 2. Layout — `@/components/layout` (owner: F1)
| Export | Notes |
|---|---|
| `Screen` | `children`, `scroll?=true`, `refreshing?`, `onRefresh?`, `header?` / `title?`, `onBack?` (default `router.back`), `right?` (header actions), `padded?=true`, `keyboardAware?`, `footer?` (sticky), `maxWidth?` — handles safe areas, wide-screen centring, pull-to-refresh |
| `ScreenHeader` | `title`, `subtitle?`, `onBack?`, `right?`, `large?` |
| `ResponsiveRow` / `useBreakpoint()` | `useBreakpoint(): { isPhone, isTablet, isDesktop, width }` |
| `Section`, `FormSection` | spacing/label grouping |
| `AppShell` | (F3) web/tablet sidebar + content + bottom tab bar on phones |

## 3. Platform layer — `@/lib/platform/*` (owner: F3, tested on web + native types)
```ts
// files.ts
saveAndShareFile(opts: { filename: string; mimeType: string; data: string | Uint8Array | Blob; encoding?: 'utf8'|'base64' }): Promise<{ uri?: string }>
downloadAndOpen(opts: { url: string; filename: string; mimeType?: string; headers?: Record<string,string> }): Promise<{ uri?: string }>
listSavedFiles / deleteSavedFile(uri) / readTextFile(uri)         // for the saved-report history
// exporter.ts  (real files)
exportTable(opts: { title: string; filename: string; columns: {key:string; title:string}[]; rows: Record<string,unknown>[]; format: 'pdf'|'xlsx'|'csv'|'doc'; subtitle?: string; orientation?: 'portrait'|'landscape' }): Promise<{ uri?: string; filename: string; mimeType: string }>
exportHtml(opts: { html: string; filename: string; format: 'pdf'|'doc' }): Promise<...>
// maps/ClockynMap.tsx (+ .web.tsx)
<ClockynMap height region={{latitude,longitude,zoom?}} markers={[{id,latitude,longitude,title?,color?,label?}]} polylines={[{id,coords,color?}]} onMapPress={(lat,lng)=>void} onMarkerPress={(id)=>void} draggableMarker? fitToMarkers? />
// location.ts
getCurrentPosition(opts?): Promise<{latitude:number; longitude:number; accuracy?:number}>   // throws LocationError('denied'|'unavailable'|'timeout')
requestLocationPermission(kind: 'foreground'|'background'): Promise<boolean>
startForegroundTracking(opts:{userId;orgId}) / stopForegroundTracking()
startBackgroundTracking(opts) / stopBackgroundTracking() / resumeTrackingIfNeeded()   // Android only; no-ops elsewhere
// notifications.ts (+ .native/.web)
registerForPush(): Promise<string|null>          // FCM token on native when available; null on web/Expo Go
subscribePushEvents(handlers:{onForeground(msg); onOpen(msg)}): () => void
showLocalNotification({title, body, data})
// permissions.ts
checkPermission(p: 'location'|'camera'|'photos'|'notifications'): Promise<'granted'|'denied'|'undetermined'>
requestPermission(p): Promise<boolean>;  openAppSettings(): void
// payment.ts (+ .native/.web)  — Razorpay checkout
openCheckout(opts:{ key: string; orderId: string; amount: number; currency: string; name: string; description?: string; prefill?: {name?; email?; contact?}; notes?: Record<string,string> }): Promise<{ status:'success'|'dismissed'|'failed'; paymentId?:string; orderId?:string; signature?:string; error?:string }>
// media.ts
pickImage(opts?: { source?: 'camera'|'library'; allowsEditing?: boolean; quality?: number }): Promise<{ uri: string; mimeType: string; fileName: string; width?: number; height?: number } | null>
pickDocument(): Promise<{ uri; name; mimeType; size? } | null>
// appUpdate.ts, analytics.ts (logEvent no-op), haptics.ts, share/clipboard helpers
```
Each web implementation must be real (Blob download, Leaflet map, `window.print`/iframe for PDF, Razorpay `checkout.js`, browser geolocation, `<input type=file>`), not stubs, except where a capability does not exist on web (background tracking, FCM) → documented no-op.

## 4. API client & domain modules — `@/lib/api/client`, `@/api/*` (owner: F2)
```ts
// client
api.get<T>(path, query?, opts?) / api.post<T>(path, body?, opts?) / api.put / api.patch / api.delete
api.upload<T>(path, form: FormData | { fileUri, fieldName, fileName, mimeType, fields? }, { onProgress?, method? })
class ApiError extends Error { status: number; detail?: string; raw?: unknown; isNetwork: boolean }
// A "500-wrapped" error like detail="403: message" is exposed with status=403, message="message", wrapped=true.
getErrorMessage(e: unknown, fallback?: string): string
// react-query
QueryProvider, queryKeys (factory per domain), useApiMutation(fn, { invalidate?: QueryKey[]; successMessage?: string })
```
One file per domain in `@/api` (typed, mirrors `../project_complete_context/shared/api/*.md`): `auth, home, staff, branches, departments, company, managers, shifts, attendance, face, requests, expenses, location, chat, groupChat, announcements, leads, payroll, salaryReports, reports, plans, billing, support, system`. Every function returns normalised, typed data (envelope variants unwrapped) and throws `ApiError` on failure (including `{success:false}` → `ApiError` with the server message). Types live in `@/types/*`.
Query hooks live in the feature that owns the screen (`features/<x>/hooks/*.ts`) using `queryKeys`.

## 5. Store, session & hooks (owner: F2/F3)
```ts
// @/store/auth (zustand, persisted under STORAGE_KEYS.auth)
type Session = { userId: string; orgId: string /* current_org_id||user_id */; orgName: string; roleId: 1|2|3; email?: string; managerPermissions: string[]; planId?: number|null; isFreeTrial?: boolean; freeTrialEnd?: string|null; deviceToken?: string; isActive?: number; name?: string }
useAuthStore; useSession(): Session|null; useRole(): 1|2|3|null; useOrgId(): string; useAuthHydrated(): boolean
signIn(session); patchSession(p); signOut(opts?: { reason?: 'logout'|'forced'|'deleted' }): Promise<void>   // full teardown (see ARCHITECTURE)
getSession(): Session|null   // non-React access
// @/store/badges  useBadges(): { chat: number; announcements: number; crm: number; requests: number }, badge actions
// @/hooks
useAsyncAction(fn, { successMessage?, errorMessage?, onSuccess?, onError? }): { run, loading, error }
usePolling(fn, intervalMs, { enabled?, immediate? })
useRefreshOnFocus(refetch) ; useDebounce(value, ms) ; useBreakpoint() ; useOrgPlan(): { planId, isFreeTrial, isExpired, isBlocked(feature), message(feature), isLoading }
// @/lib/datetime (IST business time) — todayIST(), toDateStr(Date|string) (YYYY-MM-DD in IST), monthRange(year, month), addDaysStr, formatDate(str, fmt?), formatTime12(str), formatDateTime, daysBetween, isSunday(str), parseDateStr, nowIST(), greeting()
// @/lib/format — formatINR(n, {decimals?}), formatNumber, maskPhone, initials(name), pluralize
// @/lib/storage — STORAGE_KEYS (all keys prefixed with `@clockyn/`), getJSON/setJSON/remove, storageKeyFor(key, orgId|userId)
// @/lib/navigation — useAppRouter(): { push(route, params?), replace(route, params?), back(), dismissAll() } typed over routes; goHome(role)
// @/config/plans — PLAN_IDS, PLAN_NAMES, isFeatureBlocked(status, feature), planBlockMessage(...)
```

## 6. Realtime (owner: F3)
`@/lib/realtime/socket.ts`: `createSocket({ path, onMessage, onOpen?, onClose?, pingMs?=30000 })` → `{ send, close }` with exponential-backoff reconnect (the v1 sockets did not reconnect). `useGlobalSocket()` mounted by the root bootstrap feeds `@/store/badges`. Chat screens use `useChatSocket(userId, onMessage)` / `useGroupSocket(groupId, userId, onMessage)` (same file).

## 7. Routing & shell (owner: F3)
Root layout, role guards, tab layouts, `AppShell`, notification-tap routing and the bootstrap (session watcher, badge socket, push registration, update check, location resume) — see `docs/ARCHITECTURE.md`. Route files for each feature screen are created by the feature builder (see `docs/ROUTES.md`).
