/** Local registry of downloaded invoice PDFs (native only). Pure list helpers; persistence is in `useDownloadedInvoices`. */
import type { Invoice } from '@/types/api/billing';

export interface DownloadedInvoice {
  invoiceNumber: string;
  planName: string;
  paymentDate: string | null;
  validTill: string | null;
  staffCount: number;
  totalAmount: number;
  /** Saved file uri. */
  filePath: string;
  /** ISO timestamp. */
  downloadedAt: string;
}

export function toDownloadedInvoice(invoice: Invoice, filePath: string, now: Date = new Date()): DownloadedInvoice {
  return {
    invoiceNumber: invoice.number,
    planName: invoice.planName,
    paymentDate: invoice.paymentDate,
    validTill: invoice.validTill,
    staffCount: invoice.staffCount,
    totalAmount: invoice.totalAmount,
    filePath,
    downloadedAt: now.toISOString(),
  };
}

/** Newest first; a re-download replaces the previous entry of the same invoice number. */
export function upsertDownload(list: readonly DownloadedInvoice[], entry: DownloadedInvoice): DownloadedInvoice[] {
  return [entry, ...list.filter((d) => d.invoiceNumber !== entry.invoiceNumber)];
}

export function removeDownload(list: readonly DownloadedInvoice[], invoiceNumber: string): DownloadedInvoice[] {
  return list.filter((d) => d.invoiceNumber !== invoiceNumber);
}

/** Tolerant parse of the persisted JSON (corrupt entries are dropped). */
export function parseDownloads(raw: unknown): DownloadedInvoice[] {
  if (!Array.isArray(raw)) return [];
  const out: DownloadedInvoice[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.invoiceNumber !== 'string' || typeof r.filePath !== 'string' || r.invoiceNumber === '' || r.filePath === '') continue;
    out.push({
      invoiceNumber: r.invoiceNumber,
      planName: typeof r.planName === 'string' ? r.planName : '',
      paymentDate: typeof r.paymentDate === 'string' ? r.paymentDate : null,
      validTill: typeof r.validTill === 'string' ? r.validTill : null,
      staffCount: typeof r.staffCount === 'number' ? r.staffCount : 0,
      totalAmount: typeof r.totalAmount === 'number' ? r.totalAmount : 0,
      filePath: r.filePath,
      downloadedAt: typeof r.downloadedAt === 'string' ? r.downloadedAt : new Date(0).toISOString(),
    });
  }
  return out;
}
