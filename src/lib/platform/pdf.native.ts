/**
 * HTML → PDF — NATIVE implementation. expo-print renders the HTML to a real PDF (WKWebView / Android
 * WebView printing), which is then stored with the requested file name and (optionally) shared.
 */
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import type { PdfExportOptions } from './pdf';
import { saveAndShareFile } from './files.native';

export type { PdfExportOptions } from './pdf';

// A4 in PostScript points.
const A4 = { width: 595, height: 842 };

export async function exportPdf(opts: PdfExportOptions): Promise<{ uri?: string }> {
  const landscape = opts.orientation === 'landscape';
  const printed = await Print.printToFileAsync({
    html: opts.html,
    width: landscape ? A4.height : A4.width,
    height: landscape ? A4.width : A4.height,
    margins: { top: 24, right: 24, bottom: 24, left: 24 },
    base64: true,
  });
  try {
    if (!printed.base64) throw new Error('PDF rendering produced no data');
    const saved = await saveAndShareFile({
      filename: opts.filename,
      mimeType: 'application/pdf',
      data: printed.base64,
      encoding: 'base64',
      share: opts.share !== false,
    });
    return { uri: saved.uri };
  } finally {
    try {
      const tmp = new File(printed.uri);
      if (tmp.exists) tmp.delete();
    } catch {
      /* temp file cleanup is best-effort */
    }
  }
}
