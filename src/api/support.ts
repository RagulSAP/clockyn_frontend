/**
 * Support API — `/support/*`: subjects, the organisation's tickets (with reply threads), new ticket
 * (optional photo, multipart) and customer replies.
 *
 * The ticket `subject` sent on submit is the subject NAME, not its id (server contract).
 */
import { api } from '@/lib/api/client';
import type {
  SubmitTicketInput,
  SupportSubject,
  SupportFaq,
  SupportVideo,
  SupportTicket,
  TicketReply,
  TicketReplyInput,
  TicketStatus,
} from '@/types/api/support';
import { arr, bool, listOf, optStr, rec, str } from './mappers/common';
import { toUploadFile } from './params';
import { ensureSuccess, requireId, seg } from './sharedHelpers';

const SUPPORT_UPLOAD_TIMEOUT_MS = 30_000;

/** Maps the wire status (`created`/`open`, `in_progress`, `resolved`/`closed`) to a `TicketStatus`. */
export function mapTicketStatus(v: unknown): TicketStatus {
  const s = str(v).toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'in_progress' || s === 'inprogress') return 'in_progress';
  if (s === 'resolved' || s === 'closed') return 'resolved';
  return 'open';
}

/** Maps one wire reply. */
export function mapTicketReply(input: unknown): TicketReply {
  const r = rec(input);
  return {
    text: str(r.reply_text),
    authorName: str(r.author_name),
    isAdmin: bool(r.is_admin),
    createdAt: optStr(r.created_at) ?? null,
  };
}

/** Maps one wire ticket; a legacy single admin `reply` becomes one thread entry when there are no replies. */
export function mapSupportTicket(input: unknown): SupportTicket {
  const r = rec(input);
  let replies = arr(r.replies).map(mapTicketReply).filter((x) => x.text !== '');
  const legacy = optStr(r.reply);
  if (replies.length === 0 && legacy) {
    replies = [{ text: legacy, authorName: 'Admin Reply', isAdmin: true, createdAt: null }];
  }
  return {
    id: str(r.id),
    subjectId: str(r.sub_id),
    subject: str(r.sub_name),
    message: str(r.client_msg),
    photoUrl: optStr(r.photo_url) ?? null,
    status: mapTicketStatus(r.status),
    createdAt: optStr(r.created_at) ?? null,
    replies,
    raw: r,
  };
}

/** `GET /support/subjects` — subjects for the new-ticket form. */
export async function listSupportSubjects(): Promise<SupportSubject[]> {
  const body = await api.get<unknown>('/support/subjects');
  return listOf(body).map((r) => ({ id: str(r.sub_id), name: str(r.sub_name) }));
}

/** `GET /support/videos` — the Video Hub: active guide videos only (the server hides status 0) with presigned playback URLs. */
export async function listSupportVideos(): Promise<SupportVideo[]> {
  const body = await api.get<unknown>('/support/videos');
  return listOf(body)
    .map((r) => ({ id: str(r.id), name: str(r.name).trim(), url: str(r.url) }))
    .filter((v) => v.name !== '' && /^https?:\/\//i.test(v.url));
}

/** `GET /support/faqs` — the Support > FAQ list: active FAQs only, in display order (sort order, then id). Entries without a question or answer are dropped; a missing bucket or category becomes 'General'. */
export async function listFaqs(): Promise<SupportFaq[]> {
  const body = await api.get<unknown>('/support/faqs');
  return listOf(body)
    .map((r) => ({
      id: str(r.id),
      bucket: str(r.faq_bucket).trim() || 'General',
      category: str(r.category).trim() || 'General',
      question: str(r.question).trim(),
      answer: str(r.answer).replace(/\r\n?/g, '\n').trim(),
    }))
    .filter((f) => f.question !== '' && f.answer !== '');
}

/** `POST /support/videos/{id}/view` `{user_id, org_id}` — tells the server a guide video was opened (operators see it on their Video Views page). */
export async function recordVideoView(videoId: string, input: { userId: string; orgId: string }): Promise<void> {
  await api.post<unknown>(`/support/videos/${seg(requireId(videoId, 'videoId'))}/view`, { user_id: input.userId, org_id: input.orgId });
}

/** `GET /support/requests/{orgId}` — the organisation's tickets with their reply threads. */
export async function listTickets(orgId: string): Promise<SupportTicket[]> {
  const body = await api.get<unknown>(`/support/requests/${seg(requireId(orgId, 'orgId'))}`);
  return listOf(body).map(mapSupportTicket);
}

/** `POST /support/submit` (multipart `subject, message, user_id, org_id, photo?`) — raises a new ticket. */
export async function submitTicket(input: SubmitTicketInput): Promise<void> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject === '') throw new Error('Select a subject');
  if (message === '') throw new Error('Enter your message');
  const fields = { subject, message, user_id: input.userId, org_id: input.orgId };
  let body: unknown;
  if (input.photo) {
    body = await api.upload<unknown>(
      '/support/submit',
      { ...toUploadFile(input.photo, 'photo', 'support'), fields },
      { timeoutMs: SUPPORT_UPLOAD_TIMEOUT_MS },
    );
  } else {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    body = await api.post<unknown>('/support/submit', form, { timeoutMs: SUPPORT_UPLOAD_TIMEOUT_MS });
  }
  ensureSuccess(body, 'Failed to submit request');
}

/** `POST /support/{ticketId}/reply` `{reply_text, author_name, is_admin}` — adds a customer reply to a ticket. */
export async function replyToTicket(ticketId: string, input: TicketReplyInput): Promise<void> {
  const text = input.text.trim();
  if (text === '') throw new Error('Enter your reply');
  const body = await api.post<unknown>(`/support/${seg(requireId(ticketId, 'ticketId'))}/reply`, {
    reply_text: text,
    author_name: input.authorName,
    is_admin: input.isAdmin ?? false,
  });
  ensureSuccess(body, 'Failed to send reply');
}
