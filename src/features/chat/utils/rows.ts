import type { ChatItem } from '../types';
import { dayKey, dayLabel } from './format';

export type MessageRow = { kind: 'separator'; key: string; label: string } | { kind: 'message'; key: string; item: ChatItem };

/** In-chat search: keeps messages whose text contains the query (case-insensitive); an empty query keeps all. */
export function filterItems(items: readonly ChatItem[], query: string): ChatItem[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...items];
  return items.filter((i) => i.text.toLowerCase().includes(q));
}

/** Messages with a date separator ("Today" / "Yesterday" / "5 March 2025", IST) whenever the day changes. */
export function buildRows(items: readonly ChatItem[], now?: number): MessageRow[] {
  const rows: MessageRow[] = [];
  let lastDay = '';
  for (const item of items) {
    const day = dayKey(item.ts);
    if (day !== '' && day !== lastDay) {
      rows.push({ kind: 'separator', key: `sep_${day}`, label: dayLabel(day, now) });
      lastDay = day;
    }
    rows.push({ kind: 'message', key: item.key, item });
  }
  return rows;
}
