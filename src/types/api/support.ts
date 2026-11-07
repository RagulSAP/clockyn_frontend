/** DTOs for support tickets (`src/api/support.ts`). */
import type { RawRecord, UploadFileInput } from './common';

/** Ticket state; the server's `created` is reported as `open`. */
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

/** A subject choice in the new-ticket form. */
export interface SupportSubject {
  id: string;
  name: string;
}

/** One reply on a ticket thread. */
export interface TicketReply {
  text: string;
  authorName: string;
  /** True for replies written by the support team. */
  isAdmin: boolean;
  createdAt: string | null;
}

/** A support ticket with its thread. */
export interface SupportTicket {
  id: string;
  subjectId: string;
  subject: string;
  message: string;
  photoUrl: string | null;
  status: TicketStatus;
  createdAt: string | null;
  /** Chronological thread; a legacy single admin reply is converted into one entry. */
  replies: TicketReply[];
  raw: RawRecord;
}

/** Input of `submitTicket`. `subject` is the subject NAME (not the id). */
export interface SubmitTicketInput {
  userId: string;
  orgId: string;
  subject: string;
  message: string;
  photo?: UploadFileInput | null;
}

/** Input of `replyToTicket`. */
export interface TicketReplyInput {
  text: string;
  authorName: string;
  /** Always false for customer-side replies. */
  isAdmin?: boolean;
}

/** A Video Hub guide video (`GET /support/videos`); `url` is a presigned S3 link that expires after a few hours. */
export interface SupportVideo {
  id: string;
  name: string;
  url: string;
}
