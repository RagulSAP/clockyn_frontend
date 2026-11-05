/** Shared building blocks for the DTO types in `src/types/api/*`. */

/** Untyped JSON object as received from the server (the `raw` escape hatch). */
export type RawRecord = Record<string, unknown>;

/** Role ids used across the product: 1 admin, 2 manager, 3 staff. */
export type RoleId = 1 | 2 | 3;

/** `YYYY-MM-DD` calendar date (IST business date). */
export type DateString = string;

/** `HH:mm` 24-hour time of day. */
export type TimeString = string;

/** Status shared by requests and expenses. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/** Result of a write call that only carries a message. */
export interface ActionResult {
  message: string;
}

/** A local file chosen by the user (camera / gallery / document picker) to be uploaded. */
export interface UploadFileInput {
  uri: string;
  fileName?: string;
  mimeType?: string;
}
