# HEIC / HEIF photo uploads (iPhone)

Problem: iPhones often hand HEIC / HEIF to the image picker. The backend decides the type from the first bytes and only
accepted png / jpeg / webp / gif / pdf, so profile photos, company logos, chat images and expense receipts picked on iOS
answered 415.

## App (primary fix)

- `src/lib/platform/imageNormalize.ts` (new, native): `normalizePickedImage(picked)`.
  - JPEG / PNG (decided by mime type; without one, by the uri then file-name extension): returned untouched. Only a stale
    `.heic` / `.heif` file name on an already transcoded JPEG / PNG is corrected to `.jpg` / `.png`.
  - HEIC / HEIF / unknown: re-encoded with `expo-image-manipulator` to JPEG, quality 0.85 (`PICKED_JPEG_QUALITY`), longest
    side capped at 2048 px (`PICKED_MAX_SIDE`, never upscaled, EXIF orientation applied by the manipulator).
    `fileName` ends `.jpg`, `mimeType` is `image/jpeg`, `uri` / `width` / `height` are those of the new file.
  - Never throws: on any failure the original asset is returned (the backend still accepts HEIC from older builds).
- `src/lib/platform/media.native.ts`: `pickImage` (library and camera) returns `normalizePickedImage(...)`. Every caller
  (`useRegistration`, `useStaffEditor`, `CompanyEditScreen`, `usePersonalDetailsEditor`, `usePickAttachment`,
  `PhotoCapture`, `SupportScreen`) goes through it. `pickDocument` (chat documents, PDFs) is unchanged.
- `src/lib/platform/media.ts` (web): a file whose type is not JPEG / PNG is always converted by canvas to JPEG 0.85 (longest
  side 2048) even when the JPEG is larger (before, a smaller-than-original rule kept the HEIC from Safari).
- Face capture (`prepareFacePhoto`, `FACE_CAPTURE_OPTIONS`) already produces JPEG and is untouched.

Tests: `src/lib/platform/__tests__/imageNormalize.test.ts` (type detection, resize target, naming, HEIC -> JPEG, JPEG / PNG
passthrough, failure fallback) and `pickImageNative.test.ts` (library + camera, passthrough, failure, documents unaffected).

## Backend (older app builds)

`utils/uploads.py` recognises the `ftyp` box (brands heic, heix, hevc, hevx, mif1, msf1) and accepts it only with
`allow_heic=True`: logos, profile / staff photos, odometer and travel / bill receipts, support photo. Chat attachments take
any content and label HEIC as `image/heic` / `.heic`. The face register / punch routes still answer 415. The file is stored
as received (`*.heic`, content type `image/heic`, no server conversion). See `domains/identity_auth_onboarding.md` (Uploads).

## What a real iPhone test must confirm

1. Pick a HEIC photo from the library (Settings > Camera > Formats > High Efficiency) for profile photo, company logo,
   chat image, odometer and bill receipt: upload succeeds (200) and the picture shows afterwards (on iOS and Android).
2. The converted file is upright (orientation correct for portrait and rotated shots), at most 2048 px on the long side,
   and `fileName` ends `.jpg` in the request.
3. Camera capture (`source: 'camera'`) and a "Live Photo" / edited photo convert too; a screenshot (PNG) is untouched.
4. Face enrolment / punch still work and the face route never receives HEIC.
5. Old build behaviour: a HEIC body sent directly is 200 on the generic endpoints and 415 on `/face/*`.
6. Bucket permission: the app role has `s3:DeleteObject` on `org_logo/`, `employee_profile/`, `odo_meter_photos/` and
   `travel_bill_photos/` (otherwise a replaced picture keeps showing).
