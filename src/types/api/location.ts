import type { DateString, RawRecord, TimeString } from './common';

export interface LocationLogInput {
  userId: string;
  orgId: string;
  latitude: number;
  longitude: number;
  /** ISO timestamp; the server defaults to now. */
  timestamp?: string;
}

/** Latest known position of a field staff member (admin map). */
export interface StaffLocation {
  userId: string;
  name: string;
  empId: string;
  branch: string;
  department: string;
  latitude?: number;
  longitude?: number;
  /** ISO timestamp of the latest position. */
  updatedAt?: string;
  punchIn?: TimeString;
  punchOut?: TimeString;
  raw: RawRecord;
}

/** A point of a staff member's travelled route. */
export interface LocationPoint {
  latitude: number;
  longitude: number;
  /** ISO timestamp. */
  timestamp: string;
}

export interface LocationStats {
  /** Updated in the last 15 minutes. */
  recent: number;
  outdated: number;
  noLocation: number;
  total: number;
  date?: DateString;
}

/** Where a staff member punched in / out on a day. */
export interface PunchPin {
  userId: string;
  name: string;
  empId: string;
  branch: string;
  department: string;
  punchIn?: TimeString;
  punchOut?: TimeString;
  punchInLocation?: { latitude: number; longitude: number };
  punchOutLocation?: { latitude: number; longitude: number };
}
