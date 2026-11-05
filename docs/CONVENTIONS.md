# Conventions

## Code
- TypeScript strict; no `any` unless unavoidable (comment why). Functional components + hooks. Named exports for components/hooks; `export default` only for route/screen files.
- Files: `PascalCase.tsx` components/screens (`StaffListScreen.tsx`), `camelCase.ts` modules/hooks (`useStaffList.ts`), `kebab-case` route files/folders matching `routes.ts`.
- Styles: `StyleSheet.create` colocated; colours/spacing/typography from `useTheme()` (create styles with a `makeStyles(theme)` helper inside `useMemo`). No raw hex values in features. Use `Text` from `@/components/ui` (not RN `Text`) so typography/dark-mode apply.
- Platform: use `Platform.OS === 'web'` sparingly; prefer `.web.tsx`/`.native.tsx` file splits for components, and `useBreakpoint()` for responsive layout. Test mentally on 360px phone, 768px tablet, ≥1100px desktop web.
- Never use `Alert.alert` for in-app flows (web support is poor) — use `useConfirm()` / `useToast()` / `Modal`.
- No `console.log` (lint warns); use `console.warn/error` only for real faults. Never log OTPs, tokens or PII.
- Data: reads via `useQuery` + `@/api/*`; writes via `useApiMutation`/`useAsyncAction` with `invalidate`. No `fetch` outside `src/lib/api`. No JSON blobs in route params — pass ids and re-read from cache.
- Accessibility: `accessibilityLabel` on icon-only buttons; touch targets ≥ 44; sufficient contrast (tokens already comply).
- Money is INR via `formatINR`; dates via `@/lib/datetime`; never hand-format dates.
- Strings: user-visible copy is English literals in the screen (keep the v1 wording from the spec §8 unless it contains a legacy name or mojibake).
- Storage keys only via `STORAGE_KEYS` (`@clockyn/…`).

## Naming — hard rule
The product is **Clockyn**. No other product/vendor names anywhere (code, comments, tests, mock data, docs, file names). Run `npm run check:brand` before you finish; it must pass. Contact e-mails/URLs → `@/config/env`.

## Definition of done (per builder)
1. All screens in your row implemented with every behaviour in the spec(s) (stories + §14 checklist) + fixes per `docs/FIX_POLICY.md`.
2. Works on Android/iOS/Web (no native-only imports in screens; web paths real).
3. `npm run typecheck`, `npm run lint` clean for your files; unit tests for non-trivial logic (formulas, validation, state machines) added and passing.
4. `npm run check:brand` passes.
5. `docs/changes/<id>.md` written: **Implemented** (screens/routes), **Fixes applied** (v1 issue → fix), **Deferred** (kept v1 behaviour, needs decision), **Backend needs** (endpoint, current, needed, impact), **Deviations from spec** (with reason), **Known gaps**.
6. Reply to the lead with ≤8 lines: screens done, gaps, any shared-code changes you made.
