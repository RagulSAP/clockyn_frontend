/** DTOs of the Support tab (`src/api/support.ts`): guide videos and FAQs. */

/** A Video Hub guide video (`GET /support/videos`); `url` is a presigned S3 link that expires after a few hours. */
export interface SupportVideo {
  id: string;
  name: string;
  url: string;
}

/** An FAQ of the Support > FAQ screen (`GET /support/faqs`, active ones only, already in display order). */
export interface SupportFaq {
  id: string;
  /** Top-level group (the tiles of the FAQ landing). `faq_bucket` on the wire, 'General' when missing. */
  bucket: string;
  /** Sub-topic inside the bucket. */
  category: string;
  question: string;
  /** Plain text; `\n` is a line break. */
  answer: string;
}
