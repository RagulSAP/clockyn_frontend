import type { RawRecord, TimeString } from './common';

export type PunchAction = 'punch_in' | 'punch_out';

/** Geofence pre-check result. `allowed: false` carries the server message ("You are 250m away ..."). */
export interface LocationCheck {
  allowed: boolean;
  message: string;
}

/**
 * Structured outcome of `POST /face/punch` (`ok` on success). Old servers send no code: the screen then falls back to
 * the message strings (`isNoFaceMessage`, `is_holiday`).
 */
export type FaceResultCode =
  | 'ok'
  | 'holiday_blocked'
  | 'not_registered'
  | 'image_unreadable'
  | 'no_face'
  | 'no_match'
  | 'out_of_range'
  | 'location_required'
  | 'already_punched_in'
  | 'max_sessions'
  | 'no_active_punch'
  | 'invalid_action'
  | 'server_error';

/** Why a photo was unusable (sent with `no_face` / `image_unreadable`). */
export type FaceFailureReason = 'too_dark' | 'too_blurry' | 'too_small' | 'unknown';

/** `code` / `reason` of a face response or error body (both optional: old servers send neither). */
export interface FaceFailureInfo {
  code?: FaceResultCode;
  reason?: FaceFailureReason;
}

/** `GET /face/warmup/{user_id}` result. */
export interface FaceWarmup {
  registered: boolean;
  /** Server time spent loading the user's face data. */
  ms: number;
}

export interface PunchInput {
  userId: string;
  orgId: string;
  action: PunchAction;
  /** Local URI of the captured face photo. */
  faceUri: string;
  latitude?: number;
  longitude?: number;
  /** Skip face verification (v1 fallback after a failed match); the punch is flagged for admin review. */
  forceAccept?: boolean;
}

/**
 * Outcome of a punch. Business-rule failures (holiday, face not recognised, outside the branch area,
 * already punched in ...) come back with `success: false` because the screen branches on them; transport
 * and plan-block errors (HTTP 4xx/5xx) are thrown as `ApiError`.
 */
export interface PunchResult extends FaceFailureInfo {
  success: boolean;
  message: string;
  /** Server time of the punch, `HH:mm` (IST). */
  time?: TimeString;
  attendanceId?: string;
  workHours?: number;
  totalWorkHours?: number;
  /** Accepted but flagged: the face did not match (pending admin review). */
  faceMismatch: boolean;
  isHoliday: boolean;
  raw: RawRecord;
}

export interface RegisterFaceInput {
  userId: string;
  orgId: string;
  /** At least 4 local photo URIs. */
  faceUris: string[];
}
