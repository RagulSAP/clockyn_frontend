/**
 * Pure logic of the admin announcement composer: audience -> API payload mapping, validation, labels, selection
 * helpers and history search. No React, no I/O (unit tested).
 */
import type { IconName } from '@/components/ui';
import type { Announcement, CreateAnnouncementInput } from '@/types/api/announcements';

export const TITLE_MAX = 100;
export const MESSAGE_MAX = 1000;
export const TITLE_WARN_AT = 80;
export const MESSAGE_WARN_AT = 900;
/** The success dialog closes by itself after this long (v1: 2200 ms). */
export const SUCCESS_DIALOG_MS = 2200;

/** Who receives an announcement. `null` ids mean "not chosen yet". */
export type ComposeAudience =
  | { kind: 'all' }
  | { kind: 'selected'; userIds: string[] }
  | { kind: 'branch'; branchId: string | null }
  | { kind: 'dept'; deptId: string | null };

export interface AudienceNames {
  branchName?: string;
  deptName?: string;
}

/** First validation problem of a draft (v1 order and wording), or `null` when it can be sent. */
export function validateCompose(title: string, message: string, audience: ComposeAudience): string | null {
  if (title.trim() === '') return 'Title is required';
  if (message.trim() === '') return 'Message is required';
  switch (audience.kind) {
    case 'selected':
      return audience.userIds.length === 0 ? 'Select at least 1 staff member' : null;
    case 'branch':
      return audience.branchId === null || audience.branchId === '' ? 'Select a branch' : null;
    case 'dept':
      return audience.deptId === null || audience.deptId === '' ? 'Select a department' : null;
    default:
      return null;
  }
}

/** Send button state: disabled while anything is missing or a send is in flight. */
export function isSendDisabled(title: string, message: string, audience: ComposeAudience, sending: boolean): boolean {
  return sending || validateCompose(title, message, audience) !== null;
}

/**
 * Maps a draft to the create call input. Throws when the audience is incomplete (callers validate first).
 * (`buildAnnouncementBody` in `@/api/announcements` turns it into the wire body: trimmed title / message;
 * `selected_user_ids` only for `selected`; `branch_id` only for `branch`; `dept_id` only for `dept`.)
 */
export function toCreateInput(args: {
  orgId: string;
  sentById: string;
  title: string;
  message: string;
  audience: ComposeAudience;
}): CreateAnnouncementInput {
  const { orgId, sentById, title, message, audience } = args;
  const base = { orgId, sentById, title, message };
  switch (audience.kind) {
    case 'all':
      return { ...base, target: 'all' };
    case 'selected':
      if (audience.userIds.length === 0) throw new Error('Select at least 1 staff member');
      return { ...base, target: 'selected', selectedUserIds: [...audience.userIds] };
    case 'branch':
      if (audience.branchId === null || audience.branchId === '') throw new Error('Select a branch');
      return { ...base, target: 'branch', branchId: audience.branchId };
    case 'dept':
      if (audience.deptId === null || audience.deptId === '') throw new Error('Select a department');
      return { ...base, target: 'dept', deptId: audience.deptId };
  }
}

/** Label of the send button. */
export function sendLabel(audience: ComposeAudience, names: AudienceNames = {}): string {
  switch (audience.kind) {
    case 'all':
      return 'Send to All Staff';
    case 'selected':
      return `Send to ${audience.userIds.length} Staff`;
    case 'branch':
      return `Send to ${names.branchName || 'Branch'}`;
    case 'dept':
      return `Send to ${names.deptName || 'Department'}`;
  }
}

/**
 * Subtitle of the success dialog. MUST be computed from the draft BEFORE the form is reset (v1 reset the audience
 * first, so the dialog always showed the fallback text).
 */
export function successSubtitle(audience: ComposeAudience, names: AudienceNames = {}): string {
  switch (audience.kind) {
    case 'all':
      return 'All staff have been notified';
    case 'selected':
      return `${audience.userIds.length} staff member${audience.userIds.length === 1 ? '' : 's'} notified`;
    case 'branch':
      return `${names.branchName || 'Branch'} staff notified`;
    case 'dept':
      return `${names.deptName || 'Department'} staff notified`;
  }
}

// ── staff picker ───────────────────────────────────────────────────────────────────────────

/** Toggle one id in a selection (order of insertion kept). */
export function toggleId(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/** True when every id of a non-empty `visible` list is selected. */
export function allVisibleSelected(selected: readonly string[], visible: readonly string[]): boolean {
  if (visible.length === 0) return false;
  const set = new Set(selected);
  return visible.every((id) => set.has(id));
}

/**
 * "Select all" over the currently visible (filtered) rows. Fix over v1: ids chosen outside the current filter are
 * kept (v1 replaced the whole selection); pressing it again removes only the visible ids.
 */
export function toggleSelectAll(selected: readonly string[], visible: readonly string[]): string[] {
  if (allVisibleSelected(selected, visible)) {
    const drop = new Set(visible);
    return selected.filter((id) => !drop.has(id));
  }
  const have = new Set(selected);
  return [...selected, ...visible.filter((id) => !have.has(id))];
}

export interface PickableStaff {
  userId: string;
  name: string;
  department: string;
  branch: string;
}

/** Picker search: name, department or branch contains the (trimmed) query, case-insensitive. */
export function filterStaff<T extends PickableStaff>(staff: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...staff];
  return staff.filter((s) => [s.name, s.department, s.branch].some((v) => (v ?? '').toLowerCase().includes(q)));
}

/** "Dept · Branch" (either part optional), or "Staff" when neither is known. */
export function staffSubtitle(s: Pick<PickableStaff, 'department' | 'branch'>): string {
  const parts = [s.department, s.branch].filter((p) => p && p.trim() !== '');
  return parts.length > 0 ? parts.join(' · ') : 'Staff';
}

/** First word of the name for a selection chip ("Staff" when unknown). */
export function chipLabel(name: string | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first ? first : 'Staff';
}

// ── history / feeds ────────────────────────────────────────────────────────────────────────

/** Case-insensitive search over title and message (and the branch / department name when asked). The query is trimmed. */
export function filterAnnouncements(list: readonly Announcement[], query: string, withNames = false): Announcement[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...list];
  return list.filter((a) => {
    const hay = [a.title, a.message];
    if (withNames) hay.push(a.branchName ?? '', a.deptName ?? '');
    return hay.some((v) => v.toLowerCase().includes(q));
  });
}

export interface AudienceTag {
  icon: IconName;
  label: string;
}

/** Audience pill of an announcement card (admin history shows every target; feeds show their own). */
export function audienceTag(a: Pick<Announcement, 'target' | 'branchName' | 'deptName' | 'recipientCount'>, opts: { feed?: 'broadcast' | 'targeted' } = {}): AudienceTag {
  switch (a.target) {
    case 'branch':
      return { icon: 'building', label: a.branchName || 'Branch' };
    case 'dept':
      return { icon: 'layers', label: a.deptName || 'Department' };
    case 'selected':
      // The admin list carries the recipient count; the employee feed does not.
      return opts.feed === 'broadcast' ? { icon: 'megaphone', label: 'Selected Staff' } : { icon: 'user', label: `${a.recipientCount || 0} Staff` };
    default:
      return { icon: opts.feed === 'broadcast' ? 'megaphone' : 'users', label: 'All Staff' };
  }
}

const PALETTE = ['primary', 'info', 'success', 'warning', 'danger', 'accent', 'statusHalfDay', 'statusHoliday'] as const;
export type AccentToken = (typeof PALETTE)[number];

/** Stable accent of an announcement: `sum(charCodes(id)) % 8` (v1 rule) mapped to theme tokens. */
export function accentIndex(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum % PALETTE.length;
}

export function accentToken(id: string): AccentToken {
  return PALETTE[accentIndex(id)];
}

/** `#RRGGBB` + alpha (0-1) -> `#RRGGBBAA`; other formats are returned unchanged. */
export function tint(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${color}${a}`;
}

/** True when a counter should use the warning colour. */
export function counterWarn(length: number, warnAt: number): boolean {
  return length > warnAt;
}
