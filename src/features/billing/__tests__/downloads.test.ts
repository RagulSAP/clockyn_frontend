import type { Invoice } from '@/types/api/billing';

import { parseDownloads, removeDownload, toDownloadedInvoice, upsertDownload } from '../utils/downloads';

const invoice = (number: string): Invoice => ({
  id: number,
  number,
  paymentDate: '2026-10-01',
  planName: 'Prime',
  staffCount: 15,
  totalAmount: 8496,
  validTill: '2027-10-01',
  raw: {},
});

describe('downloaded invoice registry', () => {
  it('a re-download replaces the old entry and moves to the top', () => {
    const a = toDownloadedInvoice(invoice('INV-1'), 'file:///a.pdf', new Date('2026-10-02T00:00:00Z'));
    const b = toDownloadedInvoice(invoice('INV-2'), 'file:///b.pdf', new Date('2026-10-03T00:00:00Z'));
    const a2 = toDownloadedInvoice(invoice('INV-1'), 'file:///a2.pdf', new Date('2026-10-04T00:00:00Z'));
    let list = upsertDownload([], a);
    list = upsertDownload(list, b);
    expect(list.map((d) => d.invoiceNumber)).toEqual(['INV-2', 'INV-1']);
    list = upsertDownload(list, a2);
    expect(list.map((d) => d.invoiceNumber)).toEqual(['INV-1', 'INV-2']);
    expect(list[0].filePath).toBe('file:///a2.pdf');
  });

  it('removes by invoice number', () => {
    const list = [toDownloadedInvoice(invoice('INV-1'), 'f1'), toDownloadedInvoice(invoice('INV-2'), 'f2')];
    expect(removeDownload(list, 'INV-1').map((d) => d.invoiceNumber)).toEqual(['INV-2']);
  });

  it('drops corrupt persisted entries', () => {
    const good = toDownloadedInvoice(invoice('INV-1'), 'file:///a.pdf');
    const parsed = parseDownloads([good, null, 'x', { invoiceNumber: 'INV-9' }, { invoiceNumber: '', filePath: 'f' }, { invoiceNumber: 'INV-3', filePath: 'f3' }]);
    expect(parsed.map((d) => d.invoiceNumber)).toEqual(['INV-1', 'INV-3']);
    expect(parseDownloads('nope')).toEqual([]);
  });
});
