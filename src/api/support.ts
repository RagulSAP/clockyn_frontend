/**
 * Support API: `/support/*` for the Support tab. The guide videos of the Video Hub, the FAQ list and the "video opened" ping.
 * (The old support-ticket screen and its endpoints are gone: Live Chat replaces them.)
 */
import { api } from '@/lib/api/client';
import type { SupportFaq, SupportVideo } from '@/types/api/support';
import { listOf, str } from './mappers/common';
import { requireId, seg } from './sharedHelpers';

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
