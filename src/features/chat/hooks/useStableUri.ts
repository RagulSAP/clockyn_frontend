import { useState } from 'react';

/**
 * Locks the FIRST non-empty URI of an attachment for the lifetime of the bubble. The sender's optimistic bubble
 * starts with a local file URI and later receives the server URL, and received presigned URLs get a new signature on
 * every refetch: swapping the displayed source would flash / re-download the picture.
 */
export function useStableUri(candidate: string | null | undefined): string | null {
  const [locked, setLocked] = useState<string | null>(candidate || null);
  // adjust state while rendering (React's documented pattern for derived state) instead of in an effect
  if (!locked && candidate) setLocked(candidate);
  return locked ?? (candidate || null);
}
