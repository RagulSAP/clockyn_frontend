import type { ChatItem } from '../../types';
import { normalizeThemeIndex, resolveChatTheme, sanitizeThemeMap } from '../chatThemes';
import {
  bubbleTime,
  dayKey,
  dayLabel,
  directListTime,
  displayFileName,
  extensionOf,
  groupListTime,
  joinParts,
  lastMessagePreview,
  matchesQuery,
  resolveMessageKind,
} from '../format';
import { buildRows, filterItems } from '../rows';
import { lightColors } from '@/theme';

describe('message kind and previews', () => {
  it('detects the extension without the query string', () => {
    expect(extensionOf('https://x/y/photo.JPG?sig=abc.def')).toBe('jpg');
    expect(extensionOf('noext')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
  });

  it('resolves how a message renders (images are inferred from the extension, the server stores "file")', () => {
    expect(resolveMessageKind({ type: 'text', text: 'hello' })).toBe('text');
    expect(resolveMessageKind({ type: 'image', fileUrl: 'https://x/a.bin', text: 'a' })).toBe('image');
    expect(resolveMessageKind({ type: 'file', fileUrl: 'https://x/a.png?x=1', text: 'a.png' })).toBe('image');
    expect(resolveMessageKind({ type: 'file', fileUrl: 'https://x/a.mp4', text: 'a.mp4' })).toBe('video');
    expect(resolveMessageKind({ type: 'file', fileUrl: 'https://x/report.pdf', text: 'report.pdf' })).toBe('file');
    // optimistic bubble: no URL yet, the file name decides
    expect(resolveMessageKind({ type: 'file', fileUrl: null, text: 'scan.heic' })).toBe('image');
    expect(resolveMessageKind({ type: 'file', fileUrl: null, text: 'sheet.xlsx' })).toBe('file');
  });

  it('strips the upload id prefix from file names', () => {
    expect(displayFileName('https://cdn/x/0123456789abcdef0123456789abcdef_Salary%20Sheet.xlsx?sig=1')).toBe('Salary Sheet.xlsx');
    expect(displayFileName('plain.pdf')).toBe('plain.pdf');
    expect(displayFileName('')).toBe('File');
  });

  it('list previews: known type wins, then extension, then bare links, else the text', () => {
    expect(lastMessagePreview('anything', 'image')).toMatchObject({ kind: 'image', text: 'Photo' });
    expect(lastMessagePreview('anything', 'file')).toMatchObject({ kind: 'file', text: 'File' });
    expect(lastMessagePreview('holiday.png')).toMatchObject({ kind: 'image' });
    expect(lastMessagePreview('terms.PDF')).toMatchObject({ kind: 'file' });
    expect(lastMessagePreview('https://x.example/doc')).toMatchObject({ kind: 'link', text: 'Attachment' });
    expect(lastMessagePreview('See you at 5')).toEqual({ kind: 'text', text: 'See you at 5' });
    expect(lastMessagePreview('')).toEqual({ kind: 'none', text: '' });
    expect(lastMessagePreview(null, null).kind).toBe('none');
  });
});

describe('times and separators (IST)', () => {
  const now = Date.parse('2026-10-18T10:00:00Z'); // 15:30 IST on 18 Oct

  it('list times', () => {
    expect(directListTime('2026-10-18T09:59:30Z', now)).toBe('Just now');
    expect(directListTime('2026-10-18T09:40:00Z', now)).toBe('20m ago');
    expect(directListTime('2026-10-18T07:00:00Z', now)).toBe('3h ago');
    expect(directListTime('2026-10-17T05:00:00Z', now)).toBe('Yesterday');
    expect(directListTime('2026-10-01T05:00:00Z', now)).toBe('Oct 1');
    expect(directListTime(null, now)).toBe('');
    expect(groupListTime('2026-10-18T07:00:00Z', now)).toBe('12:30 PM');
  });

  it('bubble time is IST and empty for invalid timestamps', () => {
    expect(bubbleTime('2026-10-18T10:00:00Z')).toBe('03:30 PM');
    expect(bubbleTime('garbage')).toBe('');
  });

  it('day labels: Today / Yesterday / full date, grouped by the IST day', () => {
    const today = dayKey(now);
    expect(today).toBe('2026-10-18');
    expect(dayLabel(today, now)).toBe('Today');
    expect(dayLabel('2026-10-17', now)).toBe('Yesterday');
    expect(dayLabel('2025-03-05', now)).toBe('5 March 2025');
    // 19:00 UTC on the 17th is already the 18th in IST
    expect(dayKey(Date.parse('2026-10-17T19:00:00Z'))).toBe('2026-10-18');
  });

  it('separators appear exactly when the day changes and follow the in-chat search', () => {
    const mk = (id: string, iso: string, text: string): ChatItem => ({
      key: id,
      id,
      senderId: 'x',
      senderName: '',
      fromMe: false,
      text,
      type: 'text',
      fileUrl: null,
      sentAt: iso,
      ts: Date.parse(iso),
      isRead: true,
      isDelivered: true,
      readCount: 0,
      totalMembers: 0,
      state: 'sent',
    });
    const items = [mk('a', '2026-10-16T05:00:00Z', 'Alpha plan'), mk('b', '2026-10-18T05:00:00Z', 'beta'), mk('c', '2026-10-18T06:00:00Z', 'ALPHA again')];
    const rows = buildRows(items, now);
    expect(rows.map((r) => (r.kind === 'separator' ? r.label : r.item.id))).toEqual(['16 October 2026', 'a', 'Today', 'b', 'c']);
    const found = buildRows(filterItems(items, 'alpha'), now);
    expect(found.map((r) => (r.kind === 'separator' ? r.label : r.item.id))).toEqual(['16 October 2026', 'a', 'Today', 'c']);
    expect(filterItems(items, '  ')).toHaveLength(3);
  });
});

describe('small helpers', () => {
  it('matchesQuery and joinParts', () => {
    expect(matchesQuery('', 'x')).toBe(true);
    expect(matchesQuery('ab', 'xABy', null)).toBe(true);
    expect(matchesQuery('zz', 'abc', undefined)).toBe(false);
    expect(joinParts('Staff', '', undefined, 'Sales', 'Pune')).toBe('Staff · Sales · Pune');
  });
});

describe('group themes', () => {
  it('only accepts known theme indexes and sanitises the persisted map', () => {
    expect(normalizeThemeIndex(3)).toBe(3);
    expect(normalizeThemeIndex(99)).toBe(0);
    expect(normalizeThemeIndex('x')).toBe(0);
    expect(sanitizeThemeMap({ a: 2, b: 8, c: 'nope', d: '5' })).toEqual({ a: 2, d: 5 });
    expect(sanitizeThemeMap(null)).toEqual({});
    expect(sanitizeThemeMap([1, 2])).toEqual({});
  });

  it('Default follows the app theme tokens; the others are fixed palettes', () => {
    expect(resolveChatTheme(0, lightColors).background).toBe(lightColors.background);
    expect(resolveChatTheme(0, lightColors).myBubble).toBe(lightColors.primary);
    expect(resolveChatTheme(6, lightColors).background).not.toBe(lightColors.background);
  });
});
