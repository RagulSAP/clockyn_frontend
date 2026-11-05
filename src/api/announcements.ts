/**
 * Announcements API — the LIVE `/api/announcements*` endpoints used by the admin and employee screens
 * (create for all / selected / branch / dept, admin history, delete, employee feed).
 * The legacy `/announcement/*` family (no callers) is intentionally not ported.
 *
 * Targeting rules are unchanged from v1 (only role 1 may send; the server resolves recipients).
 */
import { api } from '@/lib/api/client';
import type {
  Announcement,
  AnnouncementTarget,
  CreateAnnouncementInput,
  CreatedAnnouncement,
} from '@/types/api/announcements';
import { listOf, num, objectOf, optNum, optStr, rec, str } from './mappers/common';
import { ensureSuccess, requireId, seg } from './sharedHelpers';

const TARGETS: readonly AnnouncementTarget[] = ['all', 'selected', 'branch', 'dept'];

/** Maps the wire `target` to a known value (anything unknown is treated as `all`). */
export function mapAnnouncementTarget(v: unknown): AnnouncementTarget {
  const s = str(v).toLowerCase();
  return (TARGETS as readonly string[]).includes(s) ? (s as AnnouncementTarget) : 'all';
}

/** Maps one wire announcement row to an `Announcement`. */
export function mapAnnouncement(input: unknown): Announcement {
  const r = rec(input);
  return {
    id: str(r.id ?? r.announcement_id),
    title: str(r.title),
    message: str(r.message),
    target: mapAnnouncementTarget(r.target),
    branchId: optNum(r.branch_id) ?? null,
    deptId: optStr(r.dept_id) ?? null,
    branchName: optStr(r.branch_name) ?? null,
    deptName: optStr(r.dept_name) ?? null,
    sentBy: str(r.sent_by),
    createdAt: str(r.created_at),
    recipientCount: num(r.recipient_count),
    raw: r,
  };
}

/** Organisation-wide announcements (`all` and `selected` targets) — the "Broadcast" feed. */
export function filterBroadcast(list: readonly Announcement[]): Announcement[] {
  return list.filter((a) => a.target === 'all' || a.target === 'selected');
}

/** Branch / department announcements — the "Targeted" feed. */
export function filterTargeted(list: readonly Announcement[]): Announcement[] {
  return list.filter((a) => a.target === 'branch' || a.target === 'dept');
}

/** Builds the `POST /api/announcements` body for the chosen audience. */
export function buildAnnouncementBody(input: CreateAnnouncementInput): Record<string, unknown> {
  const base = {
    org_id: input.orgId,
    sent_by_id: input.sentById,
    title: input.title.trim(),
    message: input.message.trim(),
    target: input.target,
  };
  switch (input.target) {
    case 'selected':
      return { ...base, selected_user_ids: input.selectedUserIds };
    case 'branch':
      return { ...base, branch_id: Number(input.branchId) };
    case 'dept':
      return { ...base, dept_id: input.deptId };
    default:
      return base;
  }
}

/** `POST /api/announcements` — sends an announcement to the chosen audience (admin only). */
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<CreatedAnnouncement> {
  if (input.target === 'selected' && input.selectedUserIds.length === 0) throw new Error('Select at least one recipient');
  if (input.target === 'branch' && !Number.isFinite(Number(input.branchId))) throw new Error('Select a branch');
  if (input.target === 'dept' && input.deptId.trim() === '') throw new Error('Select a department');
  const body = await api.post<unknown>('/api/announcements', buildAnnouncementBody(input));
  ensureSuccess(body, 'Failed to send announcement');
  const data = objectOf(body);
  return { id: str(data.announcement_id ?? data.id), recipientCount: num(data.recipient_count) };
}

/** `POST /api/announcements` (target `all`) — announces to every staff member of the organisation. */
export function sendToAll(args: { orgId: string; sentById: string; title: string; message: string }): Promise<CreatedAnnouncement> {
  return createAnnouncement({ ...args, target: 'all' });
}

/** `POST /api/announcements` (target `selected`) — announces to specific staff members. */
export function sendToSelected(args: {
  orgId: string;
  sentById: string;
  title: string;
  message: string;
  selectedUserIds: string[];
}): Promise<CreatedAnnouncement> {
  return createAnnouncement({ ...args, target: 'selected' });
}

/** `POST /api/announcements` (target `branch`) — announces to every staff member of a branch. */
export function sendToBranch(args: {
  orgId: string;
  sentById: string;
  title: string;
  message: string;
  branchId: number | string;
}): Promise<CreatedAnnouncement> {
  return createAnnouncement({ ...args, target: 'branch' });
}

/** `POST /api/announcements` (target `dept`) — announces to every staff member of a department. */
export function sendToDept(args: {
  orgId: string;
  sentById: string;
  title: string;
  message: string;
  deptId: string;
}): Promise<CreatedAnnouncement> {
  return createAnnouncement({ ...args, target: 'dept' });
}

/** `GET /api/announcements/{orgId}` — admin history of every announcement (newest first). */
export async function listAnnouncements(orgId: string): Promise<Announcement[]> {
  const body = await api.get<unknown>(`/api/announcements/${seg(requireId(orgId, 'orgId'))}`);
  ensureSuccess(body, 'Failed to load announcements');
  return listOf(body).map(mapAnnouncement);
}

/** `DELETE /api/announcements/{id}` — deletes an announcement (admin). */
export async function deleteAnnouncement(id: string): Promise<void> {
  const body = await api.delete<unknown>(`/api/announcements/${seg(requireId(id, 'id'))}`);
  ensureSuccess(body, 'Failed to delete announcement');
}

/** `GET /api/announcements/employee/{userId}` — announcements visible to a staff member / manager. */
export async function listEmployeeAnnouncements(userId: string): Promise<Announcement[]> {
  const body = await api.get<unknown>(`/api/announcements/employee/${seg(requireId(userId, 'userId'))}`);
  ensureSuccess(body, 'Failed to load announcements');
  return listOf(body).map(mapAnnouncement);
}

/** Ids of announcements not yet seen (used for the unread badge). */
export function unseenAnnouncementIds(list: readonly Announcement[], seenIds: Iterable<string>): string[] {
  const seen = new Set(seenIds);
  return list.filter((a) => a.id !== '' && !seen.has(a.id)).map((a) => a.id);
}
