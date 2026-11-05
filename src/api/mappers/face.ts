import type { FaceFailureInfo, FaceFailureReason, FaceResultCode, FaceWarmup, LocationCheck, PunchResult } from '@/types/api/face';
import { bool, hours, messageOf, num, optNum, optStr, rec, toHHmm } from './common';

const RESULT_CODES: readonly FaceResultCode[] = [
  'ok',
  'holiday_blocked',
  'not_registered',
  'image_unreadable',
  'no_face',
  'no_match',
  'out_of_range',
  'location_required',
  'already_punched_in',
  'max_sessions',
  'no_active_punch',
  'invalid_action',
  'server_error',
];
const FAILURE_REASONS: readonly FaceFailureReason[] = ['too_dark', 'too_blurry', 'too_small', 'unknown'];

/** `code` / `reason` of a response or error body; unknown values (a newer server) are dropped, never guessed. */
export function mapFaceFailure(body: unknown): FaceFailureInfo {
  const r = rec(body);
  const code = typeof r.code === 'string' ? r.code.trim().toLowerCase() : '';
  const reason = typeof r.reason === 'string' ? r.reason.trim().toLowerCase() : '';
  return {
    code: RESULT_CODES.find((c) => c === code),
    reason: FAILURE_REASONS.find((x) => x === reason),
  };
}

export function mapFaceWarmup(body: unknown): FaceWarmup {
  const r = rec(body);
  return { registered: bool(r.registered), ms: num(r.ms) };
}

export function mapLocationCheck(body: unknown): LocationCheck {
  const r = rec(body);
  return { allowed: r.success === true, message: messageOf(r) };
}

/** `/face/punch` body -> DTO (success and failure shapes). */
export function mapPunchResult(body: unknown): PunchResult {
  const r = rec(body);
  return {
    success: r.success === true,
    message: messageOf(r),
    ...mapFaceFailure(r),
    time: toHHmm(r.time),
    attendanceId: optStr(r.attendance_id),
    workHours: hours(r.work_hours),
    totalWorkHours: optNum(r.total_work_hours),
    faceMismatch: bool(r.face_mismatch),
    isHoliday: bool(r.is_holiday),
    raw: r,
  };
}
