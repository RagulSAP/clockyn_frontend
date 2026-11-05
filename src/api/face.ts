/** Face-recognition punching: enrolment, geofence pre-check and the punch itself. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult, UploadFileInput } from '@/types/api/common';
import { isApiError } from '@/lib/api/errors';
import type { FaceFailureInfo, FaceWarmup, LocationCheck, PunchInput, PunchResult, RegisterFaceInput } from '@/types/api/face';
import { mapFaceFailure, mapFaceWarmup, mapLocationCheck, mapPunchResult } from './mappers/face';
import { bool, messageOf, rec } from './mappers/common';
import { toUploadFile } from './params';
import { seg } from './sharedHelpers';

/** Timeout of the punch upload (v1: 30 s). */
const PUNCH_TIMEOUT_MS = 30_000;
/** Timeout of the face enrolment upload (v1: 60 s). */
const REGISTER_TIMEOUT_MS = 60_000;
/** Minimum number of photos the server needs to enrol a face. */
export const MIN_FACE_PHOTOS = 4;

/** Whether the user has enrolled a face. `GET /face/check/{userId}`. */
export async function isFaceRegistered(userId: string): Promise<boolean> {
  const body = await api.get<unknown>(`/face/check/${seg(userId)}`);
  return bool(rec(body).registered);
}

/**
 * Loads the user's face data into the server cache so the first punch is fast. `GET /face/warmup/{userId}`.
 * Best-effort: never throws (older servers answer 404), callers do not await it for UI.
 */
export async function warmup(userId: string): Promise<FaceWarmup | null> {
  try {
    return mapFaceWarmup(await api.get<unknown>(`/face/warmup/${seg(userId)}`));
  } catch {
    return null;
  }
}

/** `code` / `reason` carried by a thrown registration/punch error (HTTP 400 body); `{}` for old servers. */
export function failureOf(e: unknown): FaceFailureInfo {
  return isApiError(e) ? mapFaceFailure(e.raw) : {};
}

/**
 * Geofence pre-check before opening the camera. `POST /face/check-location` (form-encoded).
 * Resolves `{allowed:false, message}` when the user is outside the branch radius (the message is
 * shown as-is); HTTP errors throw.
 */
export async function checkPunchLocation(input: { userId: string; latitude: number; longitude: number }): Promise<LocationCheck> {
  const form = new URLSearchParams();
  form.append('user_id', input.userId);
  form.append('latitude', String(input.latitude));
  form.append('longitude', String(input.longitude));
  const body = await api.post<unknown>('/face/check-location', form);
  return mapLocationCheck(body);
}

/**
 * Punches in / out with a face photo. `POST /face/punch` (multipart: `user_id, org_id, action, face,
 * latitude?, longitude?, force_accept?`).
 *
 * Business-rule failures (holiday, face not recognised, outside the branch area, already punched in ...)
 * resolve with `success: false` so the screen can branch (holiday / "no face" retry / force-accept
 * fallback); HTTP errors (e.g. 403 plan block) throw `ApiError`.
 */
export async function punch(input: PunchInput): Promise<PunchResult> {
  const body = await api.upload<unknown>(
    '/face/punch',
    {
      fileUri: input.faceUri,
      fieldName: 'face',
      fileName: 'face.jpg',
      mimeType: 'image/jpeg',
      fields: {
        user_id: input.userId,
        org_id: input.orgId,
        action: input.action,
        latitude: input.latitude,
        longitude: input.longitude,
        force_accept: input.forceAccept ? 'true' : undefined,
      },
    },
    { timeoutMs: PUNCH_TIMEOUT_MS },
  );
  return mapPunchResult(body);
}

/**
 * Enrols the user's face from at least 4 photos. `POST /face/register` (multipart `user_id, org_id, faces`).
 * Throws with the server message (e.g. "No face detected ...") when enrolment is refused.
 */
export async function registerFace(input: RegisterFaceInput): Promise<ActionResult> {
  if (input.faceUris.length < MIN_FACE_PHOTOS) throw new Error(`At least ${MIN_FACE_PHOTOS} face photos are required`);
  const body = assertSuccess(
    await api.upload<unknown>(
      '/face/register',
      {
        files: input.faceUris.map((uri, i) => ({ fileUri: uri, fieldName: 'faces', fileName: `face${i}.jpg`, mimeType: 'image/jpeg' })),
        fields: { user_id: input.userId, org_id: input.orgId },
      },
      { timeoutMs: REGISTER_TIMEOUT_MS },
    ),
    'Face registration failed',
  );
  return { message: messageOf(body, 'Face registered successfully') };
}

/** Stores a profile photo (sent after the face enrolment with the first photo). `POST /profile-photo/{userId}` (field `photo`). */
export async function saveProfilePhoto(userId: string, file: UploadFileInput): Promise<void> {
  const body = await api.upload<unknown>(`/profile-photo/${seg(userId)}`, toUploadFile(file, 'photo', 'profile'));
  assertSuccess(body, 'Failed to save profile photo');
}
