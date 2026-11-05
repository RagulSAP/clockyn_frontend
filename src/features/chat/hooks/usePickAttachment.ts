import { useCallback } from 'react';

import { useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { MediaPermissionError, pickDocument, pickImage } from '@/lib/platform/media';
import { resolveMessageKind } from '../utils/format';

export interface PickedAttachment {
  uri: string;
  fileName: string;
  mimeType: string;
  /** The message type the attachment will be shown as (images are recognised by their extension too). */
  type: 'image' | 'file';
}

/** Camera / library photo and document pickers with user-visible failures (v1 swallowed a refused permission). */
export function usePickAttachment(): {
  pickPhoto: (source: 'camera' | 'library') => Promise<PickedAttachment | null>;
  pickFile: () => Promise<PickedAttachment | null>;
} {
  const toast = useToast();

  const pickPhoto = useCallback(
    async (source: 'camera' | 'library'): Promise<PickedAttachment | null> => {
      try {
        const img = await pickImage({ source, quality: 0.8 });
        if (!img) return null;
        return { uri: img.uri, fileName: img.fileName || `photo_${Date.now()}.jpg`, mimeType: img.mimeType || 'image/jpeg', type: 'image' };
      } catch (e) {
        toast.error(e instanceof MediaPermissionError ? e.message : getErrorMessage(e, 'Could not open the camera'));
        return null;
      }
    },
    [toast],
  );

  const pickFile = useCallback(async (): Promise<PickedAttachment | null> => {
    try {
      const doc = await pickDocument();
      if (!doc) return null;
      const mimeType = doc.mimeType || 'application/octet-stream';
      const kind = resolveMessageKind({ type: 'file', text: doc.name });
      return { uri: doc.uri, fileName: doc.name, mimeType, type: kind === 'image' ? 'image' : 'file' };
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not open the file picker'));
      return null;
    }
  }, [toast]);

  return { pickPhoto, pickFile };
}
