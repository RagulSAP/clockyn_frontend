import type { LeadCategory } from '@/types/api/leads';

/** Case-insensitive substring search over category names (empty search keeps everything). */
export function filterCategories(categories: readonly LeadCategory[], search: string): LeadCategory[] {
  const q = search.trim().toLowerCase();
  return q === '' ? [...categories] : categories.filter((c) => c.name.toLowerCase().includes(q));
}
