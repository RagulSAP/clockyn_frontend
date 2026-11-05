/** Date filter of the expense review lists (pure). Dates are IST calendar strings (`YYYY-MM-DD`), compared as strings. */

export function filterByDate<T extends { date: string }>(items: readonly T[], date: string): T[] {
  if (!date) return [...items];
  return items.filter((i) => i.date === date);
}

/** `3 of 12 records` */
export function recordsLabel(shown: number, total: number): string {
  return `${shown} of ${total} records`;
}

/** Fallback toast when approving / rejecting fails and the server sent no message: `Failed to approve ticket`. */
export function reviewFailureMessage(subject: 'ticket' | 'bill' | 'reading', status: 'approved' | 'rejected'): string {
  return `Failed to ${status === 'approved' ? 'approve' : 'reject'} ${subject}`;
}
