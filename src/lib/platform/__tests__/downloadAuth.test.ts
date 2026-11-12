/**
 * REQUIRE_AUTH=1: file downloads made outside the JSON client (attendance PDFs, invoices) must carry the session's bearer
 * token when the URL is on the API host, and must NOT send it to another host (S3 presigned chat files).
 * Covers both implementations: `files.ts` (web, fetch) and `files.native.ts` (expo-file-system `File.downloadFileAsync`).
 * (docs/DEFERRED_DECISIONS.md DD-64 said attendance PDFs were fetched without auth headers; they are not any more.)
 */
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth';

const downloads: { url: string; headers: Record<string, string> }[] = [];

jest.mock('expo-file-system', () => {
  class Directory {
    exists = true;
    create(): void {}
  }
  class File {
    exists = false;
    uri = 'file:///docs/clockyn-files/x.pdf';
    size = 10;
    delete(): void {}
    static async downloadFileAsync(url: string, _dest: unknown, opts: { headers?: Record<string, string> } = {}): Promise<File> {
      downloads.push({ url, headers: opts.headers ?? {} });
      return new File();
    }
  }
  return { Directory, File, Paths: { document: 'file:///docs' } };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => false, shareAsync: async () => undefined }));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: async () => undefined }));

const API_PDF = `${env.apiBaseUrl}/api/reports/monthly-attendance/u1/2026-10`;
const S3_FILE = 'https://bucket.s3.ap-south-1.amazonaws.com/chat/a.pdf?X-Amz-Signature=abc';

function signIn(accessToken?: string): void {
  useAuthStore.setState({ session: { userId: 'u1', orgId: 'o1', orgName: 'Acme', roleId: 1, managerPermissions: [], accessToken } });
}

describe('downloadAndOpen (native)', () => {
  // jest-expo resolves `files` to files.native.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { downloadAndOpen } = require('../files') as typeof import('../files');

  beforeEach(() => {
    downloads.length = 0;
    useAuthStore.setState({ session: null });
  });

  it('sends the bearer token for an attendance PDF on the API host', async () => {
    signIn('tok-1');
    await downloadAndOpen({ url: API_PDF, filename: 'attendance.pdf', mimeType: 'application/pdf', open: false });
    expect(downloads).toHaveLength(1);
    expect(downloads[0].headers).toEqual({ Authorization: 'Bearer tok-1' });
  });

  it('sends no Authorization to another host (presigned S3 link) nor without a token', async () => {
    signIn('tok-1');
    await downloadAndOpen({ url: S3_FILE, filename: 'a.pdf', open: false });
    signIn(undefined);
    await downloadAndOpen({ url: API_PDF, filename: 'attendance.pdf', open: false });
    expect(downloads.map((d) => d.headers)).toEqual([{}, {}]);
  });

  it('a caller header can still be added next to the token', async () => {
    signIn('tok-1');
    await downloadAndOpen({ url: API_PDF, filename: 'a.pdf', open: false, headers: { Accept: 'application/pdf' } });
    expect(downloads[0].headers).toEqual({ Authorization: 'Bearer tok-1', Accept: 'application/pdf' });
  });
});

describe('downloadAndOpen (web)', () => {
  const fetchMock = jest.fn();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('../files.ts') as typeof import('../files');

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'application/pdf' }, blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }) });
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
    useAuthStore.setState({ session: null });
  });

  const sentHeaders = (): Record<string, string> => (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers;

  it('sends the bearer token for an attendance PDF on the API host', async () => {
    signIn('tok-2');
    await web.downloadAndOpen({ url: API_PDF, filename: 'attendance.pdf', open: false });
    expect(fetchMock.mock.calls[0][0]).toBe(API_PDF);
    expect(sentHeaders()).toEqual({ Authorization: 'Bearer tok-2' });
  });

  it('sends no Authorization to another host and none without a token', async () => {
    signIn('tok-2');
    await web.downloadAndOpen({ url: S3_FILE, filename: 'a.pdf', open: false });
    expect(sentHeaders()).toEqual({});
    fetchMock.mockClear();
    signIn(undefined);
    await web.downloadAndOpen({ url: API_PDF, filename: 'a.pdf', open: false });
    expect(sentHeaders()).toEqual({});
  });

  it('a 401 / 403 answer is a download failure with the server message (no file is kept)', async () => {
    signIn('tok-2');
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => JSON.stringify({ detail: 'Token expired' }) });
    await expect(web.downloadAndOpen({ url: API_PDF, filename: 'a.pdf', open: false })).rejects.toMatchObject({ code: 'download_failed', message: 'Token expired' });
  });
});
