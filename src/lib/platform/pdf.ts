/**
 * HTML → PDF — WEB / default implementation: print-to-PDF through a hidden iframe.
 * The browser's print dialog offers "Save as PDF"; no file is produced by the app itself, so `uri` is
 * undefined. (Native implementation: `pdf.native.ts`, which writes a real PDF file via expo-print.)
 */
import type { Orientation } from './exportFormats';

export type PdfExportOptions = {
  html: string;
  /** Final file name, e.g. `attendance_2026-05.pdf` (used as the print/document title). */
  filename: string;
  orientation?: Orientation;
  /** Native only: open the share sheet after writing the file (default true). Ignored on web. */
  share?: boolean;
};

export async function exportPdf(opts: PdfExportOptions): Promise<{ uri?: string }> {
  if (typeof document === 'undefined') throw new Error('PDF export needs a browser environment');
  const title = opts.filename.replace(/\.pdf$/i, '');
  const previousTitle = document.title;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  } as Partial<CSSStyleDeclaration>);

  await new Promise<void>((resolve, reject) => {
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.title = previousTitle;
      iframe.remove();
    };
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error('Could not open the print preview'));
        return;
      }
      try {
        win.document.title = title;
        document.title = title; // some browsers use the top-level title as the suggested PDF name
        win.addEventListener('afterprint', cleanup);
        win.focus();
        win.print();
        // Safari returns immediately from print(); Chrome blocks until the dialog closes. Either way,
        // keep the frame alive until `afterprint` (or a generous timeout) so printing is never cut short.
        setTimeout(cleanup, 5 * 60_000);
        resolve();
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error('Printing failed'));
      }
    };
    iframe.srcdoc = opts.html;
    document.body.appendChild(iframe);
  });
  return {};
}
