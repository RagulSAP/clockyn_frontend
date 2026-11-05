import type { LocationPoint, LocationStats, PunchPin, StaffLocation } from '@/types/api/location';
import { dateOnly, num, optNum, optStr, rec, str, toHHmm } from './common';

export function mapStaffLocation(input: unknown): StaffLocation {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    branch: str(r.branch_name),
    department: str(r.dept_name),
    latitude: optNum(r.latitude),
    longitude: optNum(r.longitude),
    updatedAt: optStr(r.location_updated_at),
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    raw: r,
  };
}

/** Returns `undefined` when the point has no usable coordinates. */
export function mapLocationPoint(input: unknown): LocationPoint | undefined {
  const r = rec(input);
  const latitude = optNum(r.latitude);
  const longitude = optNum(r.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude, timestamp: str(r.timestamp) };
}

export function mapLocationStats(body: unknown): LocationStats {
  const r = rec(body);
  const d = rec(r.data);
  return {
    recent: num(d.recent),
    outdated: num(d.outdated),
    noLocation: num(d.no_location),
    total: num(d.total),
    date: dateOnly(r.date),
  };
}

function coords(lat: unknown, lng: unknown): { latitude: number; longitude: number } | undefined {
  const latitude = optNum(lat);
  const longitude = optNum(lng);
  return latitude === undefined || longitude === undefined ? undefined : { latitude, longitude };
}

export function mapPunchPin(input: unknown): PunchPin {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    branch: str(r.branch_name),
    department: str(r.dept_name),
    punchIn: toHHmm(r.punch_in),
    punchOut: toHHmm(r.punch_out),
    punchInLocation: coords(r.punch_in_lat, r.punch_in_lng),
    punchOutLocation: coords(r.punch_out_lat, r.punch_out_lng),
  };
}
