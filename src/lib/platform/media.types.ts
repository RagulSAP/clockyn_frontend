export type PickImageOptions = {
  /** `camera` opens the camera (web: `<input capture>`), `library` the photo library / file chooser. Default `library`. */
  source?: 'camera' | 'library';
  /** Native crop UI. Ignored on the web. */
  allowsEditing?: boolean;
  /** JPEG quality 0–1 (default 0.8). */
  quality?: number;
};

export type PickedImage = {
  uri: string;
  mimeType: string;
  fileName: string;
  width?: number;
  height?: number;
  /** Web only: the underlying File (handy for FormData uploads). */
  file?: File;
};

export type PickDocumentOptions = {
  /** Mime type(s) or extensions to allow, e.g. `['application/pdf', 'image/*']`. Default: any. */
  type?: string | string[];
};

export type PickedDocument = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  /** Web only: the underlying File. */
  file?: File;
};

/** Thrown by `pickImage` when the camera / photo permission was refused (a cancelled pick resolves `null`). */
export class MediaPermissionError extends Error {
  readonly permission: 'camera' | 'photos';
  constructor(permission: 'camera' | 'photos') {
    super(permission === 'camera' ? 'Camera permission is required.' : 'Photo library permission is required.');
    this.name = 'MediaPermissionError';
    this.permission = permission;
  }
}

export const DEFAULT_IMAGE_QUALITY = 0.8;
