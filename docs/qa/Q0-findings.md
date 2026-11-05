# Q0 findings (E2E harness build)

Scope: route smoke (106 visits x desktop + phone), guards/forced-logout, UI login, harness self-tests - 332 tests, all green on the current build.

## App bugs

None found. The page-issue collector (uncaught errors, console.error, failed local requests, mock 404/405/5xx) was clean on every registry route for the
role-appropriate session on both viewports, and the harness verified it can detect each kind (`specs/03-harness.spec.ts`).

No blocker prevented the harness from running, so no application source was changed.

## Observations (not bugs, worth knowing when writing suites)

| Area | Observation | Evidence |
|---|---|---|
| `/staff/home` | The "today is <colleague>'s birthday" modal covers the screen and intercepts clicks (e.g. the sidebar Logout). The mock keeps it off by default; opt in with `mock.setState({ birthdays: ['stf-0003'] })`. | `specs/03-harness.spec.ts` "opt-in fixtures" |
| `/admin/settings` (phone) | Logout is nested inside the "Beyond" accordion (the desktop sidebar has a direct button). `logoutViaUi` handles both. | `settingsMenu.ts`, `01-guards.spec.ts` |
| Chat | Every chat open requests `GET /auth/push-token/{id}`, which the backend does not route (404, handled as "no token"). Allow-listed in `e2e/support/allowlist.json`. | `src/api/chat.ts` |
| Plan block | Chat and group lists receive a plan block as HTTP 500 `"403: ..."` (backend quirk, documented in `docs/` and handled by the client). The mock reproduces it. | `03-harness` "plan simulation" |
| OTP input | `OTPInput`'s `testID` is on the single hidden `<input>`, not on the box row; `fill` it directly. | `support/auth.ts` |
| Home badges | The admin Requests badge is derived from the pending-request list (refetched on `request_submitted`), so pushing the bare socket frame without a stored request does not change it. | `03-harness` "realtime" |

## Coverage notes / gaps to pick up in Q1-Q3

* Punch flow with the camera (staff home) is available in the mock (`/face/*`, geofence, holiday, mismatch) but no spec drives the UI yet.
* Uploads (profile photo, odometer, expenses, chat files, support photo) are accepted and recorded; UI-level picker interaction needs `setInputFiles`.
* Razorpay checkout is stubbed (`setCheckoutMode`); the payment verification path is covered by the mock self-check only.
