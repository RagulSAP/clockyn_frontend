/** Shared types of the reports feature. */

/** Export formats offered by the report screens (UI labels: PDF, DOC, Excel, CSV). */
export type ReportFormat = 'pdf' | 'doc' | 'xlsx' | 'csv';

/** One entry of the saved-report history ("View Reports" tab). The file lives in the app's saved-files store. */
export interface SavedReport {
  id: string;
  /** Display name, e.g. `Staff Report Oct 2026 (CSV)`. */
  name: string;
  /** Native `file://` uri, or a `blob:` URL on the web (valid for the page session only). */
  uri: string;
  /** Real file name including the real extension. */
  filename: string;
  /** Real mime type of the file (never a hard-coded `text/html`). */
  mimeType: string;
  /** ISO timestamp of when the report was generated. */
  date: string;
  size?: number;
}

/** A report column definition handed to the exporter (`key` indexes the export row). */
export interface ExportColumnDef {
  key: string;
  title: string;
}

/** A staff member as the report pickers see them (admin: org staff, manager: team + self). */
export interface ReportStaffOption {
  userId: string;
  name: string;
  empId: string;
  department: string;
  isActive: boolean;
  /** Manager's own entry ("<name> (Me)"). */
  isSelf?: boolean;
}
