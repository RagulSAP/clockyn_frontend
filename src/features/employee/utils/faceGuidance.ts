/** User guidance for face punch / registration failures (structured `code` / `reason`, v1 message strings as fallback). */
import { mapFaceFailure } from '@/api/mappers/face';
import { isApiError } from '@/lib/api/errors';
import type { FaceFailureInfo, FaceFailureReason, FaceResultCode } from '@/types/api/face';

/** "Hold still" pause before the shutter on punch capture (ms; tune here, 400-600 reads as calm). */
export const HOLD_STILL_MS = 500;
/** Consecutive failed attempts after which the tips sheet is shown. */
export const TIPS_AFTER_FAILURES = 2;

export const FACE_TIPS: readonly string[] = [
  'Face a light source — avoid strong light behind you',
  'Remove your mask, and glasses if they cause glare',
  'Hold the phone at eye level, at arm’s length',
  'Fill the oval with your face and keep still',
];

const REASON_MESSAGE: Record<Exclude<FaceFailureReason, 'unknown'>, string> = {
  too_dark: 'It’s too dark — move to a brighter place',
  too_blurry: 'Hold the phone steady and try again',
  too_small: 'Move closer — fill the oval with your face',
};

const CODE_MESSAGE: Partial<Record<FaceResultCode, string>> = {
  no_face: 'We couldn’t see your face — fill the oval',
  image_unreadable: 'We couldn’t read that photo — try again',
  no_match: 'Photo is not matching — please try again',
};

/** `code` / `reason` of a thrown registration/punch error (the 400 body); `{}` for old servers and non-API errors. */
export function failureInfoOf(e: unknown): FaceFailureInfo {
  return isApiError(e) ? mapFaceFailure(e.raw) : {};
}

/** `no face` is the one failure the user can fix by retaking the photo (v1 string match, kept for old servers). */
export function isNoFaceMessage(message: string): boolean {
  return message.toLowerCase().includes('no face');
}

/** A failed punch response (or the parts of it this module reads). */
export interface PunchFailureLike extends FaceFailureInfo {
  message: string;
  isHoliday?: boolean;
}

/** Holiday: the server flag (v1) or the structured code. */
export function isHolidayFailure(r: PunchFailureLike): boolean {
  return !!r.isHoliday || r.code === 'holiday_blocked';
}

/** No face in the photo: the structured code when present, otherwise the v1 message match. */
export function isNoFaceFailure(r: PunchFailureLike): boolean {
  return r.code ? r.code === 'no_face' : isNoFaceMessage(r.message);
}

/** Reason-specific guidance (only `no_face` / `image_unreadable` carry a reason). */
function reasonGuidance(info: FaceFailureInfo): string | undefined {
  if ((info.code === 'no_face' || info.code === 'image_unreadable') && info.reason && info.reason !== 'unknown') return REASON_MESSAGE[info.reason];
  return undefined;
}

/** Guidance for a photo without a (usable) face; `reason` refines it (too dark / blurry / small). */
export function noFaceText(info: FaceFailureInfo): string {
  return reasonGuidance({ code: 'no_face', reason: info.reason }) ?? 'We couldn’t see your face — fill the oval';
}

/** Specific guidance for a failure, or `undefined` when the server message should be shown as-is. */
export function faceGuidance(info: FaceFailureInfo): string | undefined {
  if (!info.code) return undefined;
  return reasonGuidance(info) ?? CODE_MESSAGE[info.code];
}

/** Text shown after a failed punch attempt. */
export function punchFailureText(r: PunchFailureLike, fallback = 'Punch failed — please try again'): string {
  return faceGuidance(r) ?? (r.message.trim() || fallback);
}

/** Text of a failed registration (`code`/`reason` of the 400 body, else the v1 string rules). */
export function registrationFailureText(message: string | undefined, info: FaceFailureInfo = {}): string {
  const byReason = reasonGuidance(info);
  if (byReason) return byReason;
  if (info.code === 'no_face' || (!info.code && message && isNoFaceMessage(message))) return 'Face not visible in some photos. Ensure good lighting and try again.';
  if (info.code === 'image_unreadable') return CODE_MESSAGE.image_unreadable as string;
  return message && message.trim() ? message : 'Please try again.';
}
