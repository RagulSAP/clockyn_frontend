import { deleteSavedFile } from '@/lib/platform/files';
import {
  addToHistory,
  deleteSavedReport,
  HISTORY_CAP,
  loadHistory,
  normalizeHistory,
  orphanedFiles,
  recordSavedReport,
  removeFromHistory,
} from '../history';
import { calendarWorkingDays, isInMonth, reportMonth, yearRangeFor } from '../monthRange';
import { exportFailureMessage, exportFileBase, historyName } from '../exportLabels';
import type { SavedReport } from '../../types';

jest.mock('@/lib/platform/files', () => ({ deleteSavedFile: jest.fn(async () => undefined) }));

const entry = (n: number, over: Partial<SavedReport> = {}): SavedReport => ({
  id: `id${n}`,
  name: `Report ${n}`,
  uri: `file:///r${n}.pdf`,
  filename: `r${n}.pdf`,
  mimeType: 'application/pdf',
  date: new Date(2026, 0, 1, 0, n).toISOString(),
  ...over,
});

describe('history list logic', () => {
  it('prepends newest first and prunes to the cap, evicting the oldest', () => {
    let list: SavedReport[] = [];
    for (let i = 1; i <= HISTORY_CAP; i += 1) list = addToHistory(list, entry(i)).list;
    expect(list).toHaveLength(HISTORY_CAP);
    const { list: next, evicted } = addToHistory(list, entry(999));
    expect(next).toHaveLength(HISTORY_CAP);
    expect(next[0].id).toBe('id999');
    expect(evicted.map((e) => e.id)).toEqual(['id1']);
  });

  it('replaces an older entry that points at the same file (re-export overwrites the file)', () => {
    const first = entry(1);
    const { list, evicted } = addToHistory([first, entry(2)], entry(3, { uri: first.uri }));
    expect(list.map((e) => e.id)).toEqual(['id3', 'id2']);
    expect(evicted.map((e) => e.id)).toEqual(['id1']);
    // the shared file must NOT be deleted: the new entry still uses it
    expect(orphanedFiles(evicted, list)).toEqual([]);
  });

  it('removes an entry by id and reports orphaned files', () => {
    const { list, removed } = removeFromHistory([entry(1), entry(2)], 'id1');
    expect(list.map((e) => e.id)).toEqual(['id2']);
    expect(orphanedFiles([removed!], list)).toEqual(['file:///r1.pdf']);
  });

  it('normalises stored data, dropping malformed entries and filling a missing mime type', () => {
    const out = normalizeHistory([entry(1), { id: 'x' }, null, { id: 'old', name: 'Old', uri: 'file:///old', type: 'pdf', date: '2026-01-01T00:00:00.000Z' }]);
    expect(out.map((e) => e.id)).toEqual(['id1', 'old']);
    expect(out[1].mimeType).toBe('application/octet-stream');
    expect(normalizeHistory('nope')).toEqual([]);
  });
});

describe('history storage layer (scoped by org, deletes files)', () => {
  beforeEach(() => (deleteSavedFile as jest.Mock).mockClear());

  it('records real mime/extension entries per org and deletes evicted files', async () => {
    for (let i = 0; i < HISTORY_CAP; i += 1) {
      await recordSavedReport('org1', { name: `R${i}`, uri: `file:///f${i}.xlsx`, filename: `f${i}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    expect(await loadHistory('org1')).toHaveLength(HISTORY_CAP);
    expect(deleteSavedFile).not.toHaveBeenCalled();
    const list = await recordSavedReport('org1', { name: 'Newest', uri: 'file:///new.csv', filename: 'new.csv', mimeType: 'text/csv' });
    expect(list).toHaveLength(HISTORY_CAP);
    expect(list[0]).toMatchObject({ name: 'Newest', mimeType: 'text/csv', filename: 'new.csv' });
    expect(deleteSavedFile).toHaveBeenCalledTimes(1);
    expect(deleteSavedFile).toHaveBeenCalledWith('file:///f0.xlsx');
    expect(await loadHistory('org2')).toEqual([]);
  });

  it('deleting a report removes the entry AND its file', async () => {
    const list = await recordSavedReport('org3', { name: 'A', uri: 'file:///a.pdf', filename: 'a.pdf', mimeType: 'application/pdf' });
    const after = await deleteSavedReport('org3', list[0].id);
    expect(after).toEqual([]);
    expect(deleteSavedFile).toHaveBeenCalledWith('file:///a.pdf');
    expect(await loadHistory('org3')).toEqual([]);
  });

  it('serialises concurrent exports so no entry is lost', async () => {
    await Promise.all([1, 2, 3].map((n) => recordSavedReport('org4', { name: `C${n}`, uri: `file:///c${n}`, filename: `c${n}.csv`, mimeType: 'text/csv' })));
    expect(await loadHistory('org4')).toHaveLength(3);
  });
});

describe('IST month ranges', () => {
  it('builds prefix, days, Sundays and labels from calendar math', () => {
    const oct = reportMonth(2026, 10);
    expect(oct).toMatchObject({ prefix: '2026-10', days: 31, sundays: 4, start: '2026-10-01', end: '2026-10-31', label: 'October 2026', shortName: 'Oct' });
    expect(calendarWorkingDays(oct)).toBe(27);
  });

  it('handles leap years and 5-Sunday months (month end is never dropped)', () => {
    expect(reportMonth(2028, 2)).toMatchObject({ days: 29, end: '2028-02-29', sundays: 4 });
    expect(reportMonth(2026, 3)).toMatchObject({ days: 31, sundays: 5 });
  });

  it('matches dates by month prefix', () => {
    expect(isInMonth('2026-10-31', '2026-10')).toBe(true);
    expect(isInMonth('2026-11-01', '2026-10')).toBe(false);
    expect(isInMonth(undefined, '2026-10')).toBe(false);
  });

  it('computes selectable years in IST (UTC evening of 31 Dec is already next year in IST)', () => {
    const utcEvening = Date.UTC(2026, 11, 31, 19, 0, 0); // 00:30 IST on 1 Jan 2027
    expect(yearRangeFor('reports', utcEvening)).toEqual([2025, 2030]);
    expect(yearRangeFor('attendancePdf', utcEvening)).toEqual([2022, 2031]);
    expect(yearRangeFor('reports', Date.UTC(2026, 5, 1))).toEqual([2024, 2029]);
  });
});

describe('export labels', () => {
  it('builds file names, history names and failure messages', () => {
    expect(exportFileBase('staff_report', 2026, 10)).toBe('staff_report_Oct_2026');
    expect(historyName('Staff Report', 2026, 10, 'xlsx')).toBe('Staff Report Oct 2026 (Excel)');
    expect(historyName('Late Report', 2026, 3, 'csv')).toBe('Late Report Mar 2026 (CSV)');
    expect(exportFailureMessage('pdf')).toBe('Failed to generate PDF');
    expect(exportFailureMessage('doc')).toBe('Failed to download DOC');
  });
});
