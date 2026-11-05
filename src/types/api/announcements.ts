/** DTOs for announcements (`src/api/announcements.ts`) — the live `/api/announcements*` family. */
import type { RawRecord } from './common';

/** Audience of an announcement. */
export type AnnouncementTarget = 'all' | 'selected' | 'branch' | 'dept';

/** One announcement as shown in the admin history and the employee feed. */
export interface Announcement {
  id: string;
  title: string;
  message: string;
  target: AnnouncementTarget;
  /** Only for `branch` announcements. */
  branchId: number | null;
  /** Only for `dept` announcements. */
  deptId: string | null;
  branchName: string | null;
  deptName: string | null;
  /** Display name of the sender. */
  sentBy: string;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** Number of chosen recipients (only `selected` announcements, admin list only). */
  recipientCount: number;
  raw: RawRecord;
}

/** Fields shared by every create call. */
interface AnnouncementBase {
  orgId: string;
  /** The sending admin's user id (only role 1 may send). */
  sentById: string;
  title: string;
  message: string;
}

/** Create input — a discriminated union on the audience. */
export type CreateAnnouncementInput =
  | (AnnouncementBase & { target: 'all' })
  | (AnnouncementBase & { target: 'selected'; selectedUserIds: string[] })
  | (AnnouncementBase & { target: 'branch'; branchId: number | string })
  | (AnnouncementBase & { target: 'dept'; deptId: string });

/** Result of a create call. */
export interface CreatedAnnouncement {
  id: string;
  recipientCount: number;
}
