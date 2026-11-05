/**
 * Pure display helpers shared by the chat lists and conversations: message-kind detection, list previews,
 * relative / day-separator labels (IST) and attachment names.
 */
import type { IconName } from '@/components/ui';
import { addDaysStr, formatDate, formatRelativeTime, formatTime12, parseISO, todayIST, toDateStr } from '@/lib/datetime';

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv'] as const;
export const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'csv'] as const;

export type MessageKind = 'text' | 'image' | 'video' | 'file';

/** Lower-cased extension of a URL / file name (query string stripped), or '' when there is none. */
export function extensionOf(value: string | null | undefined): string {
  if (!value) return '';
  const clean = value.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0 || dot === clean.length - 1) return '';
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : '';
}

const has = (list: readonly string[], ext: string): boolean => list.includes(ext);

/**
 * How a message must be rendered. The backend stores every upload as `file`, so images are inferred from the
 * extension of the URL (or the file name when there is no URL yet, e.g. an optimistic bubble).
 */
export function resolveMessageKind(input: { type?: string | null; fileUrl?: string | null; text?: string | null }): MessageKind {
  const type = input.type ?? 'text';
  const media = input.fileUrl || (type === 'image' || type === 'file' ? input.text : '') || '';
  if (!media) return 'text';
  const ext = extensionOf(media) || extensionOf(input.text);
  if (type === 'image' || has(IMAGE_EXTENSIONS, ext)) return 'image';
  if (has(VIDEO_EXTENSIONS, ext)) return 'video';
  return type === 'file' || input.fileUrl ? 'file' : 'text';
}

/** Name shown on a file card: last path segment, query stripped, upload id prefix (32 hex + `_`) removed. */
export function displayFileName(urlOrName: string | null | undefined): string {
  if (!urlOrName) return 'File';
  const last = urlOrName.split('?')[0].split('/').pop() ?? urlOrName;
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    decoded = last;
  }
  const stripped = decoded.replace(/^[0-9a-f]{32}_/i, '');
  return stripped === '' ? 'File' : stripped;
}

export type PreviewKind = 'none' | 'text' | 'image' | 'file' | 'link';
export interface MessagePreview {
  kind: PreviewKind;
  /** Visible text ("Photo", "File", "Attachment" or the message itself). */
  text: string;
  icon?: IconName;
}

/**
 * Last-message preview of a conversation row. A known type wins (image -> Photo, file -> File); otherwise the
 * extension of the text decides (image ext -> Photo, document ext -> File, bare URL -> Attachment), else the text.
 */
export function lastMessagePreview(message: string | null | undefined, type?: string | null): MessagePreview {
  const text = (message ?? '').trim();
  if (text === '') return { kind: 'none', text: '' };
  if (type === 'image') return { kind: 'image', text: 'Photo', icon: 'image' };
  if (type === 'file') return { kind: 'file', text: 'File', icon: 'file-text' };
  const ext = extensionOf(text);
  if (has(IMAGE_EXTENSIONS, ext)) return { kind: 'image', text: 'Photo', icon: 'image' };
  if (has(DOCUMENT_EXTENSIONS, ext)) return { kind: 'file', text: 'File', icon: 'file-text' };
  if (text.startsWith('http') && text.includes('/')) return { kind: 'link', text: 'Attachment', icon: 'paperclip' };
  return { kind: 'text', text };
}

/** Epoch ms of a backend timestamp (UTC when it carries no zone); `fallback` when unparseable. */
export function timestampMs(value: string | null | undefined, fallback: number = Date.now()): number {
  const d = parseISO(value);
  return d ? d.getTime() : fallback;
}

/** "Just now" / "5m ago" / "3h ago" / "Yesterday" / "Jan 5" (direct list). */
export function directListTime(value: string | null | undefined, now?: number): string {
  return value ? formatRelativeTime(value, { hoursAgo: true, now }) : '';
}

/** "Just now" / "5m ago" / "03:45 PM" / "Yesterday" / "Jan 5" (group list). */
export function groupListTime(value: string | null | undefined, now?: number): string {
  return value ? formatRelativeTime(value, { now }) : '';
}

/** Bubble time, IST ("03:45 PM"); '' for an invalid timestamp. */
export function bubbleTime(value: string | null | undefined): string {
  if (!value || !parseISO(value)) return '';
  return formatTime12(value);
}

/** IST calendar day of a timestamp (the grouping key of the date separators). */
export function dayKey(ms: number): string {
  return toDateStr(ms);
}

/** "Today" / "Yesterday" / "5 March 2025" for a day key (IST). */
export function dayLabel(day: string, now?: number): string {
  const today = todayIST(now);
  if (day === today) return 'Today';
  if (day === addDaysStr(today, -1)) return 'Yesterday';
  return formatDate(day, 'd MMMM yyyy');
}

/** Case-insensitive "contains" over several fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

/** Subtitle of a staff row: role, department, branch joined with a middle dot. */
export function joinParts(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' · ');
}
