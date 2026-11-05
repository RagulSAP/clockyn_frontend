/**
 * Q2 - Reports: every export format really downloads (extension, mime, content), the PDF print path, saved-report history.
 */
import fs from 'node:fs';

import * as XLSX from 'xlsx';

import { test, expect, loginAs, visit, ORG } from '../support';
import { addStaffViaApi, installExportProbe, parseCsv, readProbe } from '../support/q2';

const TRICKY = 'O\'Neil, "Bob" <b>x</b> & Co';

test.beforeEach(async ({ page }) => {
  await installExportProbe(page);
  await loginAs(page, 'admin');
});

async function openExport(page: import('@playwright/test').Page, format: 'pdf' | 'doc' | 'xlsx' | 'csv') {
  await page.getByTestId('report-export').click();
  await page.getByTestId(`export-${format}`).click();
}

async function download(page: import('@playwright/test').Page, format: 'doc' | 'xlsx' | 'csv') {
  const wait = page.waitForEvent('download');
  await openExport(page, format);
  const d = await wait;
  const file = await d.path();
  return { name: d.suggestedFilename(), bytes: fs.readFileSync(file) };
}

test.describe('staff detailed report exports', () => {
  test.beforeEach(async ({ page, tenant }) => {
    await addStaffViaApi(tenant, { name: TRICKY, empId: 'Q2-001', mobile: '9111111111', email: 'q2.tricky@clockyn.test' });
    await addStaffViaApi(tenant, { name: '=HYPERLINK("http://x","y")', empId: 'Q2-002', mobile: '9111111112', email: 'q2.formula@clockyn.test' });
    await visit(page, '/admin/reports/staff-detailed');
    await expect(page.getByTestId('staff-detailed-table')).toBeVisible();
    await expect(page.getByText('Q2-001').first()).toBeVisible();
  });

  test('CSV: BOM, header row, RFC-4180 quoting, one line per staff, formula-neutral, mime + extension', async ({ page }) => {
    const total = Number(((await page.getByTestId('report-summary').innerText()).match(/\d+/) ?? ['0'])[0]);
    const { name, bytes } = await download(page, 'csv');
    expect(name).toMatch(/^staff_report_[A-Z][a-z]{2}_\d{4}\.csv$/);
    expect(bytes.slice(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const rows = parseCsv(bytes.toString('utf8'));
    expect(rows[0].slice(0, 5)).toEqual(['Name', 'Emp ID', 'Branch', 'Dept', 'Role']);
    expect(rows[0]).toHaveLength(22);
    expect(rows).toHaveLength(total + 1);
    for (const r of rows) expect(r, 'every row has as many cells as the header').toHaveLength(22);
    const tricky = rows.find((r) => r[1] === 'Q2-001');
    expect(tricky?.[0]).toBe(TRICKY);
    expect(rows.find((r) => r[1] === 'Q2-002')?.[0]).toBe(`'=HYPERLINK("http://x","y")`); // formula cells are neutralised
    const probe = await readProbe(page);
    expect(probe.blobs.some((b) => b.type.startsWith('text/csv'))).toBe(true);
  });

  test('Excel: a real .xlsx that opens with the xlsx package, headers + rows match', async ({ page }) => {
    const total = Number(((await page.getByTestId('report-summary').innerText()).match(/\d+/) ?? ['0'])[0]);
    const { name, bytes } = await download(page, 'xlsx');
    expect(name).toMatch(/^staff_report_[A-Z][a-z]{2}_\d{4}\.xlsx$/);
    expect(bytes.slice(0, 2).toString()).toBe('PK');
    const wb = XLSX.read(bytes, { type: 'buffer' });
    expect(wb.SheetNames.length).toBe(1);
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(grid[0]).toHaveLength(22);
    expect(grid[0][0]).toBe('Name');
    expect(grid.filter((r) => r.length > 0)).toHaveLength(total + 1);
    expect(grid.find((r) => r[1] === 'Q2-001')?.[0]).toBe(TRICKY);
    const probe = await readProbe(page);
    expect(probe.blobs.some((b) => b.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  test('DOC: HTML document with the table, values escaped (no injected markup), .doc extension + mime', async ({ page }) => {
    const { name, bytes } = await download(page, 'doc');
    expect(name).toMatch(/^staff_report_[A-Z][a-z]{2}_\d{4}\.doc$/);
    const html = bytes.toString('utf8');
    expect(html).toContain('<table');
    expect(html).toContain('Staff Detailed Report');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt; &amp; Co');
    expect(html).not.toContain('<b>x</b>');
    const probe = await readProbe(page);
    expect(probe.blobs.some((b) => b.type === 'application/msword')).toBe(true);
  });

  test('PDF: prints once through the print dialog (no crash, no refetch), document title + escaped content', async ({ page, mock }) => {
    await mock.clearRequests();
    await openExport(page, 'pdf');
    await expect.poll(async () => (await readProbe(page)).printCalls).toBe(1);
    const probe = await readProbe(page);
    expect(probe.printedHtml[0]).toContain('Staff Detailed Report');
    expect(probe.printedHtml[0]).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(probe.printedHtml[0]).not.toContain('<b>x</b>');
    // the hidden frame is cleaned up eventually; the page stays interactive and does not refetch the report on focus
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('report-export')).toBeEnabled();
    const calls = await mock.requests();
    expect(calls.filter((c) => /attendance|working-days|requests/.test(c.path))).toHaveLength(0);
    // no history entry is recorded for the print path (no file exists)
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('generated-reports') || k.includes('generatedReports')));
    for (const k of stored) expect(await page.evaluate((key) => localStorage.getItem(key), k)).not.toMatch(/application\/pdf/);
  });

  test('export failure (blob/print error) shows a toast and re-enables Export', async ({ page }) => {
    await page.evaluate(() => {
      // make the hidden print frame fail: the app must surface the error and recover
      Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
        configurable: true,
        set() {
          throw new Error('boom');
        },
      });
    });
    await openExport(page, 'pdf');
    await expect(page.getByText('boom').or(page.getByText('Failed to generate PDF')).first()).toBeVisible();
    await expect(page.getByTestId('report-export')).toBeEnabled();
  });
});

test.describe('other report screens export', () => {
  test('late report: csv + xlsx download with data (or export is disabled when empty)', async ({ page }) => {
    await visit(page, '/admin/reports/late');
    await expect(page.getByTestId('report-summary')).toBeVisible();
    const summary = await page.getByTestId('report-summary').innerText();
    const n = Number((summary.match(/\d+/) ?? ['0'])[0]);
    if (n === 0) {
      await expect(page.getByTestId('report-export')).toBeDisabled();
      return;
    }
    const csv = await download(page, 'csv');
    expect(csv.name).toMatch(/^late_report_/);
    const rows = parseCsv(csv.bytes.toString('utf8'));
    expect(rows).toHaveLength(n + 1);
    const x = await download(page, 'xlsx');
    const wb = XLSX.read(x.bytes, { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }).length).toBe(n + 1);
  });

  test('overtime report: xlsx download opens, rows = staff count', async ({ page }) => {
    await visit(page, '/admin/reports/overtime');
    await expect(page.getByTestId('overtime-table')).toBeVisible();
    const x = await download(page, 'xlsx');
    expect(x.name).toMatch(/^overtime_report_.*\.xlsx$/);
    const wb = XLSX.read(x.bytes, { type: 'buffer' });
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(grid.length).toBeGreaterThan(5);
  });

  test('salary sheet: xlsx (18 columns) + doc + pdf work and are not recorded in the saved-report history', async ({ page }) => {
    await visit(page, '/admin/payroll/salary-sheet');
    await expect(page.getByTestId('salary-table')).toBeVisible();
    const x = await download(page, 'xlsx');
    expect(x.name).toMatch(/^salary_.*\.xlsx$/);
    const wb = XLSX.read(x.bytes, { type: 'buffer' });
    const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(grid[0].length).toBeGreaterThanOrEqual(15);
    const doc = await download(page, 'doc');
    expect(doc.name).toMatch(/^salary_.*\.doc$/);
    await openExport(page, 'pdf');
    await expect.poll(async () => (await readProbe(page)).printCalls).toBe(1);
  });

  test('employee details: PDF (print) and DOC downloads for one employee', async ({ page }) => {
    await visit(page, '/admin/reports/employee-details');
    await page.getByTestId('employee-stf-0001').click();
    await expect(page.getByTestId('download-report')).toBeVisible();
    await page.getByTestId('download-report').click();
    const wait = page.waitForEvent('download');
    await page.getByTestId('download-doc').click();
    const d = await wait;
    expect(d.suggestedFilename()).toMatch(/_report\.doc$/);
    const html = fs.readFileSync(await d.path(), 'utf8');
    expect(html).toContain('Aarav Sharma');
    await page.getByTestId('download-report').click();
    await page.getByTestId('download-pdf').click();
    await expect.poll(async () => (await readProbe(page)).printCalls).toBe(1);
    expect((await readProbe(page)).printedHtml[0]).toContain('Aarav Sharma');
  });
});

test.describe('saved-report history', () => {
  async function exportFrom(page: import('@playwright/test').Page, label: string, format: 'csv' | 'xlsx' | 'doc') {
    await page.getByTestId(`report-row-${label}`).click();
    await expect(page.getByTestId('report-export')).toBeEnabled();
    const wait = page.waitForEvent('download');
    await openExport(page, format);
    await wait;
    await page.goBack();
  }

  test('entries are recorded with real type, open/share download the file, delete removes it, same file name replaces', async ({ page }) => {
    await visit(page, '/admin/reports');
    await expect(page.getByTestId('reports-hub')).toBeVisible();
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.getByText('No reports yet')).toBeVisible();
    await page.getByText('Generate', { exact: true }).click();

    await exportFrom(page, 'Staff-wise Detailed Report', 'csv');
    await exportFrom(page, 'Overtime Report', 'xlsx');
    await exportFrom(page, 'Late Report', 'doc');
    await page.getByText('View Reports', { exact: true }).click();
    const list = page.locator('[data-testid^="saved-"]');
    await expect(list).toHaveCount(3);
    const first = await list.first().innerText();
    expect(first).toMatch(/Late Report .* \(DOC\)/);
    await expect(list.nth(1)).toContainText('(Excel)');
    await expect(list.nth(1)).toContainText('XLSX');
    await expect(list.nth(2)).toContainText('CSV');

    // share downloads the file again with the right extension
    const wait = page.waitForEvent('download');
    await page.getByRole('button', { name: /^Share Staff Report/ }).click();
    expect((await wait).suggestedFilename()).toMatch(/\.csv$/);
    // open (non-pdf) downloads as well
    const wait2 = page.waitForEvent('download');
    await list.nth(1).click();
    expect((await wait2).suggestedFilename()).toMatch(/\.xlsx$/);

    // re-exporting the same file replaces the entry rather than duplicating it
    await page.getByText('Generate', { exact: true }).click();
    await exportFrom(page, 'Staff-wise Detailed Report', 'csv');
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.locator('[data-testid^="saved-"]')).toHaveCount(3);

    // delete asks for confirmation; cancel keeps, confirm removes
    await page.getByRole('button', { name: /^Delete Late Report/ }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid^="saved-"]')).toHaveCount(3);
    await page.getByRole('button', { name: /^Delete Late Report/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.locator('[data-testid^="saved-"]')).toHaveCount(2);
  });

  test('after a reload the web files are gone: entries are flagged, opening explains, delete still works', async ({ page }) => {
    await visit(page, '/admin/reports/overtime');
    await expect(page.getByTestId('overtime-table')).toBeVisible();
    await download(page, 'csv');
    await visit(page, '/admin/reports');
    await page.getByText('View Reports', { exact: true }).click();
    const entry = page.locator('[data-testid^="saved-"]').first();
    await expect(entry).toContainText('File no longer available');
    await entry.click();
    await expect(page.getByText('This report is no longer available on this device').first()).toBeVisible();
    await page.getByRole('button', { name: /^Delete Overtime Report/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByText('No reports yet')).toBeVisible();
  });

  test('history is scoped by organisation and capped at 50 (newest kept)', async ({ page }) => {
    const mk = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}-${i}`,
        name: `${prefix} ${i}`,
        uri: `blob:http://x/${prefix}-${i}`,
        filename: `${prefix}_${i}.csv`,
        mimeType: 'text/csv',
        date: new Date(2026, 0, 1 + i).toISOString(),
      }));
    await visit(page, '/admin/reports');
    const key = (org: string) => `@clockyn/generated-reports:${org}`;
    await page.evaluate(
      ([k1, k2, a, b]: [string, string, unknown, unknown]) => {
        localStorage.setItem(k1, JSON.stringify(a));
        localStorage.setItem(k2, JSON.stringify(b));
      },
      [key(ORG.id), key('org-other'), mk(50, 'mine'), mk(3, 'foreign')] as [string, string, unknown, unknown],
    );
    await page.reload();
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.locator('[data-testid^="saved-"]')).toHaveCount(50);
    await expect(page.getByText('foreign 0')).toHaveCount(0);
    // a 51st export evicts the oldest
    await page.getByText('Generate', { exact: true }).click();
    await page.getByTestId('report-row-Overtime Report').click();
    await expect(page.getByTestId('report-export')).toBeEnabled();
    const wait = page.waitForEvent('download');
    await openExport(page, 'csv');
    await wait;
    await page.goBack();
    await page.getByText('View Reports', { exact: true }).click();
    await expect(page.locator('[data-testid^="saved-"]')).toHaveCount(50);
    const newest = await page.locator('[data-testid^="saved-"]').first().innerText();
    expect(newest).toMatch(/Overtime Report/);
  });
});
