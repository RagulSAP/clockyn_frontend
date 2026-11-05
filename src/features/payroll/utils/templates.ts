/**
 * Pure helpers of the "numbered template" pattern shared by daily wages, hourly charges, overtime, bonus,
 * count basis and turnover basis: numbering, the delete-latest-only rule, duplicate checks, display names.
 */

/** Minimum shape the shared template screen needs from any template type. */
export interface TemplateBase {
  id: string;
  /** Auto-numbered name (`"1"`, `"2"`, ...); may be blank for legacy rows. */
  name: string;
  assignedCount: number;
}

/** Numeric value of a template name (`"3"` -> 3), or `null` when the name is not a plain number. */
export function templateNumber(name: string | null | undefined): number | null {
  const trimmed = (name ?? '').trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** Next auto-numbered name: highest numeric name + 1 (`"1"` when there is none). Names that are not numbers are ignored. */
export function nextTemplateNumber(items: readonly { name: string }[]): string {
  let max = 0;
  for (const item of items) {
    const n = templateNumber(item.name);
    if (n !== null && n > max) max = n;
  }
  return String(max + 1);
}

/**
 * Id(s) of the template that may be deleted: the highest-numbered one (v1 rule, client side only). When no template has
 * a numeric name the last one in list order (`created_at ASC`) is used so the rule stays deterministic.
 */
export function deletableTemplateId(items: readonly TemplateBase[]): string | null {
  if (items.length === 0) return null;
  let bestId: string | null = null;
  let best = -1;
  for (const item of items) {
    const n = templateNumber(item.name);
    if (n !== null && n >= best) {
      best = n;
      bestId = item.id;
    }
  }
  return bestId ?? items[items.length - 1].id;
}

/** `true` when this template is the only one the UI offers Delete for. */
export function isDeletableTemplate(items: readonly TemplateBase[], id: string): boolean {
  return deletableTemplateId(items) === id;
}

/** Name shown on a card: the template name, or its 1-based position when the name is blank. */
export function templateDisplayName(item: { name: string }, index: number): string {
  const trimmed = item.name.trim();
  return trimmed !== '' ? trimmed : String(index + 1);
}

/** First other template whose numeric `value(item)` equals `target` (within float noise); `null` when unique. */
export function findDuplicate<T extends TemplateBase>(
  items: readonly T[],
  target: number,
  value: (item: T) => number,
  editingId?: string | null,
): T | null {
  for (const item of items) {
    if (editingId && item.id === editingId) continue;
    if (Math.abs(value(item) - target) < 1e-9) return item;
  }
  return null;
}

/** Digits-only filter (hours / minutes inputs). */
export function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** Digits and a single decimal point (percentage inputs). */
export function decimalOnly(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}
