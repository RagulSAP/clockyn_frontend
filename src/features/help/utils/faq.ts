import type { IconName } from '@/components/ui';
import type { SupportFaq } from '@/types/api/support';

/** A top-level group of the FAQ (a tile on the landing, an entry of the desktop list). */
export interface FaqBucket {
  name: string;
  count: number;
  /** Its categories (sub-topics) in the order of their first FAQ. */
  categories: string[];
}

export interface FaqCategoryGroup {
  category: string;
  items: SupportFaq[];
  /** How many FAQs the category holds in all (`items` can be cut short while a long list is still being mounted). */
  total: number;
}

export interface FaqBucketGroup {
  bucket: string;
  categories: FaqCategoryGroup[];
}

/** Buckets in the order of their FIRST FAQ (the server already sorts by sort order, then id). */
export function faqBuckets(list: readonly SupportFaq[]): FaqBucket[] {
  const out: FaqBucket[] = [];
  for (const f of list) {
    let b = out.find((x) => x.name === f.bucket);
    if (!b) {
      b = { name: f.bucket, count: 0, categories: [] };
      out.push(b);
    }
    b.count += 1;
    if (!b.categories.includes(f.category)) b.categories.push(f.category);
  }
  return out;
}

/** Groups by category, keeping the order of first appearance and the order inside each category. */
export function groupByCategory(list: readonly SupportFaq[]): FaqCategoryGroup[] {
  const groups: FaqCategoryGroup[] = [];
  for (const f of list) {
    let g = groups.find((x) => x.category === f.category);
    if (!g) {
      g = { category: f.category, items: [], total: 0 };
      groups.push(g);
    }
    g.items.push(f);
    g.total += 1;
  }
  return groups;
}

/** Bucket > category > questions for the whole list. */
export function groupByBucket(list: readonly SupportFaq[]): FaqBucketGroup[] {
  return faqBuckets(list).map((b) => ({ bucket: b.name, categories: groupByCategory(list.filter((f) => f.bucket === b.name)) }));
}

/** The first `limit` FAQs of the groups, in order; groups left with nothing are dropped (their `total` still counts all). */
export function limitCategoryGroups(groups: readonly FaqCategoryGroup[], limit: number): FaqCategoryGroup[] {
  let left = limit;
  const out: FaqCategoryGroup[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    const items = g.items.length <= left ? g.items : g.items.slice(0, left);
    left -= items.length;
    out.push(items === g.items ? g : { ...g, items });
  }
  return out;
}

/** Same for bucket groups (bucket > category > FAQs). */
export function limitBucketGroups(groups: readonly FaqBucketGroup[], limit: number): FaqBucketGroup[] {
  let left = limit;
  const out: FaqBucketGroup[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    const categories = limitCategoryGroups(g.categories, left);
    left -= categories.reduce((n, c) => n + c.items.length, 0);
    out.push({ ...g, categories });
  }
  return out;
}

/** The words of a search text: lower-cased, split on whitespace, no empties, no duplicates. */
export function searchWords(query: string): string[] {
  return [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))];
}

/**
 * Searches EVERY FAQ: all words must appear (any order, case-insensitive) in the question, answer, category or bucket name.
 * Ranked: all words in the question first, then some word in the question, then answer/category/bucket-only matches
 * (each rank keeps the server order). A blank query returns nothing: the caller shows the browse view instead.
 */
export function searchFaqs(list: readonly SupportFaq[], query: string): SupportFaq[] {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const ranked: { faq: SupportFaq; rank: number; index: number }[] = [];
  list.forEach((faq, index) => {
    const question = faq.question.toLowerCase();
    const hay = `${faq.bucket}\n${faq.category}\n${faq.question}\n${faq.answer}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return;
    const rank = words.every((w) => question.includes(w)) ? 0 : words.some((w) => question.includes(w)) ? 1 : 2;
    ranked.push({ faq, rank, index });
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((r) => r.faq);
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Splits a text into plain and matched parts (case-insensitive) so the matched words can be shown in bold. */
export function splitMatches(text: string, words: readonly string[]): TextPart[] {
  if (words.length === 0 || text === '') return [{ text, match: false }];
  const escaped = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, match: words.some((w) => w === t.toLowerCase()) }));
}

export type FaqTone = 'info' | 'success' | 'warning' | 'accent' | 'danger' | 'primary';

const KNOWN: Record<string, { icon: IconName; tone: FaqTone }> = {
  'set up & account': { icon: 'building', tone: 'info' },
  'attendance & time': { icon: 'scan-face', tone: 'success' },
  'pay & expenses': { icon: 'wallet', tone: 'warning' },
  'team & customers': { icon: 'users', tone: 'accent' },
  'plans & payments': { icon: 'credit-card', tone: 'primary' },
  'help & fixes': { icon: 'life-buoy', tone: 'danger' },
};

/** Icon and tint of a bucket; any bucket added later falls back to a help icon. */
export function bucketVisual(name: string): { icon: IconName; tone: FaqTone } {
  return KNOWN[name.trim().toLowerCase()] ?? { icon: 'help-circle', tone: 'primary' };
}

/** A stable, test- and URL-friendly id of a bucket name ("Set up & Account" -> "set-up-account"). */
export const bucketSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Finds a bucket by a name given in a link, ignoring case (and `&` / spacing differences via the slug). */
export function findBucket(buckets: readonly FaqBucket[], wanted: string | undefined): string | null {
  if (!wanted) return null;
  const w = bucketSlug(wanted);
  return buckets.find((b) => bucketSlug(b.name) === w)?.name ?? null;
}
