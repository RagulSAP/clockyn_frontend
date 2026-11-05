# Face capture — Tier A (reliability)

## Implemented
- **Capture quality / orientation / mirroring** (`features/employee/utils/prepareFacePhoto.ts`, `FACE_CAPTURE_OPTIONS`, used by BOTH the punch and the registration camera): JPEG quality 0.9, no `skipProcessing` (with it native expo-camera ignores `quality` and may return an un-rotated file), `imageType: 'jpg'` (web default is PNG, `quality` ignored), no `mirror`/`isImageMirror` (the saved file is never mirrored; only the live front-camera preview is). Checked against `node_modules/expo-camera/build/Camera.types.d.ts` and `ExpoCamera.web.js`.
- **On-device downscale** `prepareFacePhoto({uri,width,height})` via `expo-image-manipulator` (new contextual API, web supported): longest side 720 px, JPEG 0.85, never upscales, returns the ORIGINAL uri if the size is unknown or resizing throws. Applied to each punch photo and each of the 4 registration photos.
- **Hold still**: tap -> 500 ms "Hold still…" (label + disabled shutter) -> shutter -> processing -> result. No extra step.
- **Structured failures**: `FaceResultCode` / `FaceFailureReason` types, `PunchResult.code/reason`, `mapFaceFailure`, `faceApi.failureOf(e)` (registration 400 body, read from `ApiError.raw`), `faceApi.warmup(userId)` (never throws). Messages in `utils/faceGuidance.ts` (`too_dark`, `too_blurry`, `too_small`, `no_face`, `image_unreadable`, `no_match`); other codes show the server message. Old servers (no code): v1 message rules.
- **Unchanged v1 rules**: holiday = `is_holiday` flag or `holiday_blocked`; no-face (no force-accept) = code `no_face`, or message contains "no face" when there is no code; every other failure is retried once with `force_accept`; the forced-failure `verifyApplied` check is untouched. 2 sessions/day and geofence order untouched.
- **Tips sheet** (`FaceTipsSheet`): shown in the punch camera after every 2nd consecutive failed attempt (`TIPS_AFTER_FAILURES`), includes the last guidance message. Not covered by a test.

## How to tune
`HOLD_STILL_MS`, `TIPS_AFTER_FAILURES`, `FACE_TIPS` (utils/faceGuidance.ts); `FACE_PHOTO_MAX_SIDE`, `FACE_PHOTO_JPEG_QUALITY`, `FACE_CAPTURE_QUALITY`, `FACE_CAPTURE_OPTIONS` (utils/prepareFacePhoto.ts).

## Deferred / remaining
- Warm-up is now CALLED: `warmFace(userId)` in `useEmployeeHome` (when registered) and when the punch camera opens; mock server has `GET /face/warmup/:uid`.
- E2E: `q3-01-punch.spec.ts` updated (no-face text) + 2 new cases (structured `code/reason` guidance, tips sheet after 2 failures); 21/21 pass on desktop.
- Not done: registration-failure tips sheet; real-device verification of orientation/mirroring (iOS/Android front camera).

## Backend needs
| Endpoint | Needed |
|---|---|
| `POST /face/punch` | additive `code` (+ `reason` for `no_face` / `image_unreadable`) |
| `POST /face/register` | HTTP 400 `detail` + `code` / `reason` in the body |
| `GET /face/warmup/{user_id}` | `{success, registered, ms}` (client treats any error as ignorable) |

## Tests
`utils/__tests__/{prepareFacePhoto,faceGuidance}.test.ts` (helper with mocked manipulator incl. fallback, mapper code/reason, message mapping, v1 retry conditions, registration body); `FaceModals.test.tsx` updated for the new no-face text (force_accept fallback tests pass unchanged). Dependency added: `expo-image-manipulator ~58.0.16`.
