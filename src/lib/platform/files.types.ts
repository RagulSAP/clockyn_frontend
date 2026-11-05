export type FileData = string | Uint8Array | Blob;

export type SaveFileOptions = {
  filename: string;
  mimeType: string;
  data: FileData;
  /** How to interpret a string `data`. Default `utf8`. */
  encoding?: 'utf8' | 'base64';
  /**
   * Deliver the file to the user after saving (native: share sheet; web: browser download).
   * Default `true`. Pass `false` to only persist it (e.g. just to add it to the report history).
   */
  share?: boolean;
  /** Title of the native share dialog (Android). */
  dialogTitle?: string;
};

export type SavedFileResult = {
  /** Native: `file://` uri in the app documents dir. Web: a `blob:` URL (valid for this page session). */
  uri?: string;
  filename: string;
  mimeType: string;
  size?: number;
};

export type DownloadOptions = {
  url: string;
  filename: string;
  mimeType?: string;
  headers?: Record<string, string>;
  /** Open the file after download (Android viewer / iOS share sheet / web browser download). Default `true`. */
  open?: boolean;
};

export type SavedFileInfo = {
  uri: string;
  filename: string;
  mimeType: string;
  size?: number;
  /** epoch ms */
  modifiedAt?: number;
};

export type OpenFileOptions = {
  uri: string;
  mimeType?: string;
  filename?: string;
  dialogTitle?: string;
};

export type SaveToDownloadsOptions = {
  /** An already saved file (native uri or web blob URL). */
  uri: string;
  filename: string;
  mimeType: string;
};

export type SaveToDownloadsResult = {
  saved: boolean;
  uri?: string;
  /** Set when the user cancelled the folder picker. */
  cancelled?: boolean;
};

export class FileOperationError extends Error {
  readonly code: 'unavailable' | 'download_failed' | 'not_found' | 'open_failed' | 'write_failed';
  constructor(code: FileOperationError['code'], message: string) {
    super(message);
    this.name = 'FileOperationError';
    this.code = code;
  }
}
