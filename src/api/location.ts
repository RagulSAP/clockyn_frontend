/** Field-staff location: pings, live map data, route history, stats and punch pins. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { LocationLogInput, LocationPoint, LocationStats, PunchPin, StaffLocation } from '@/types/api/location';
import { listOf } from './mappers/common';
import { mapLocationPoint, mapLocationStats, mapPunchPin, mapStaffLocation } from './mappers/location';
import { dateParam } from './params';
import { seg } from './sharedHelpers';

/**
 * Sends one location ping (field staff, while punched in; every 20 s). `POST /staff-location/log`.
 * A 403 `ApiError` means tracking must stop (not field staff, not punched in, or punched out).
 */
export async function logLocation(input: LocationLogInput): Promise<void> {
  const body = await api.post<unknown>('/staff-location/log', {
    user_id: input.userId,
    org_id: input.orgId,
    latitude: input.latitude,
    longitude: input.longitude,
    timestamp: input.timestamp,
  });
  assertSuccess(body, 'Failed to log location');
}

/** Latest position of every field staff member for a date (plan-gated: 403 when blocked). `GET /staff-location/locations`. */
export async function listStaffLocations(orgId: string, date?: string | Date): Promise<StaffLocation[]> {
  const body = await api.get<unknown>('/staff-location/locations', { org_id: orgId, target_date: dateParam(date) });
  return listOf(body).map(mapStaffLocation);
}

/** A staff member's route between two dates, oldest point first. `GET /staff-location/history/{userId}`. */
export async function getLocationHistory(userId: string, startDate?: string | Date, endDate?: string | Date): Promise<LocationPoint[]> {
  const body = assertSuccess(
    await api.get<unknown>(`/staff-location/history/${seg(userId)}`, { start_date: dateParam(startDate), end_date: dateParam(endDate) }),
    'Failed to load location history',
  );
  return listOf(body)
    .map(mapLocationPoint)
    .filter((p): p is LocationPoint => p !== undefined);
}

/** Freshness buckets of field-staff locations (plan-gated). `GET /staff-location/stats`. */
export async function getLocationStats(orgId: string, date?: string | Date): Promise<LocationStats> {
  const body = assertSuccess(
    await api.get<unknown>('/staff-location/stats', { org_id: orgId, target_date: dateParam(date) }),
    'Failed to load location stats',
  );
  return mapLocationStats(body);
}

/** Where each staff member punched in / out on a date. `GET /home/staff-punch-locations`. */
export async function listPunchPins(orgId: string, date?: string | Date): Promise<PunchPin[]> {
  const body = await api.get<unknown>('/home/staff-punch-locations', { org_id: orgId, target_date: dateParam(date) });
  return listOf(body).map(mapPunchPin);
}
