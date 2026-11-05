/** Employee punch state: today's attendance and per-day punch sessions. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { PunchSession, TodayAttendance } from '@/types/api/attendance';
import { mapSessions, mapTodayAttendance } from './mappers/attendance';
import { requiredDateParam } from './params';
import { seg } from './sharedHelpers';

/** Today's punch state (max 2 sessions per day). `GET /attendance/today/{userId}`. */
export async function getToday(userId: string): Promise<TodayAttendance> {
  const body = assertSuccess(await api.get<unknown>(`/attendance/today/${seg(userId)}`), 'Failed to load attendance');
  return mapTodayAttendance(body);
}

/** Punch sessions (times + photos) of one day. `GET /attendance/sessions/{userId}?date=`. */
export async function getSessions(userId: string, date: string | Date): Promise<PunchSession[]> {
  const body = assertSuccess(
    await api.get<unknown>(`/attendance/sessions/${seg(userId)}`, { date: requiredDateParam(date, 'date') }),
    'Failed to load punch sessions',
  );
  return mapSessions(body);
}
