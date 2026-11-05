import type { TodayAttendance } from '@/types/api/attendance';

/**
 * "Still working": punched in and not punched out yet — the check made before location tracking resumes.
 *
 * v1 read it as `is_punched_in && !punch_out`. During a SECOND session the server may keep reporting the first
 * session's punch-out, which would wrongly stop tracking, so an open last session (no punch-out) also counts.
 */
export function isStillWorking(today: Pick<TodayAttendance, 'isPunchedIn' | 'punchOut' | 'sessions'>): boolean {
  if (!today.isPunchedIn) return false;
  if (!today.punchOut) return true;
  const last = today.sessions[today.sessions.length - 1];
  return !!last && !last.punchOut;
}
