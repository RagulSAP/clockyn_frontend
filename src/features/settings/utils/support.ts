import type { Tone } from '@/components/ui';
import { ApiError, getErrorMessage } from '@/lib/api/errors';
import type { TicketReply, TicketStatus } from '@/types/api/support';

export const SUGGEST_SUBJECT_MAX = 120;
export const SUGGEST_MESSAGE_MAX = 1000;
export const TICKET_REDIRECT_DELAY_MS = 1500;
export const SUGGEST_REDIRECT_DELAY_MS = 1800;

/** First validation problem of the new-ticket form (subject is checked before the message), or null. */
export function validateTicket(subject: string, message: string): string | null {
  if (subject.trim() === '') return 'Please select a subject';
  if (message.trim() === '') return 'Please enter a message';
  return null;
}

/** First validation problem of the feature-suggestion form, or null. */
export function validateSuggestion(subject: string, content: string): string | null {
  if (subject.trim() === '') return 'Please enter a subject';
  if (content.trim() === '') return 'Please enter your message';
  return null;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' };
export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { open: 'warning', in_progress: 'primary', resolved: 'success' };

/** Author label of a thread entry: support replies show their author (or "Admin"), everything else is "You". */
export function replyAuthorLabel(reply: Pick<TicketReply, 'isAdmin' | 'authorName'>): string {
  return reply.isAdmin ? reply.authorName.trim() || 'Admin' : 'You';
}

/** Toast text for a failed ticket submission (timeouts get their own wording). */
export function ticketSubmitError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isTimeout) return 'Upload timed out. Please check your connection and try again.';
    if (e.isNetwork) return getErrorMessage(e);
    if (e.detail && e.detail.trim() !== '') return e.detail;
    return e.status > 0 ? `Submission failed (HTTP ${e.status})` : 'Failed to submit. Please try again.';
  }
  return getErrorMessage(e, 'Failed to submit. Please try again.');
}
