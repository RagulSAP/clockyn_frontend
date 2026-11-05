import { ApiError } from '@/lib/api/errors';
import { apiUrl, buildQuery, cleanQuery, ensureSuccess, mapMessageType, requireId, resolveMimeType, seg, serverMessage, successBody } from '../sharedHelpers';

describe('sharedHelpers', () => {
  it('buildQuery encodes values and drops empty ones', () => {
    expect(buildQuery({ a: 1, b: 'x y', c: undefined, d: null, e: '', f: false })).toBe('?a=1&b=x%20y&f=false');
    expect(buildQuery({})).toBe('');
  });

  it('cleanQuery drops null / undefined / empty', () => {
    expect(cleanQuery({ a: 1, b: '', c: null, d: undefined, e: 'z' })).toEqual({ a: 1, e: 'z' });
  });

  it('seg encodes path segments', () => {
    expect(seg('a/b c')).toBe('a%2Fb%20c');
    expect(seg(7)).toBe('7');
  });

  it('apiUrl builds an absolute URL with the query', () => {
    const url = apiUrl('/invoice/download', { user_id: 'u1', invoice_number: 'INV 1', skip: undefined });
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('/invoice/download?user_id=u1&invoice_number=INV%201');
    expect(url).not.toContain('skip');
  });

  it('ensureSuccess throws an ApiError with the server message for success:false', () => {
    expect(() => ensureSuccess({ success: true }, 'x')).not.toThrow();
    expect(() => ensureSuccess([1, 2], 'x')).not.toThrow();
    expect(() => ensureSuccess(null, 'x')).not.toThrow();
    try {
      ensureSuccess({ success: false, message: 'Already assigned', payslip_name: 'A' }, 'fallback');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).message).toBe('Already assigned');
      expect((e as ApiError).raw).toMatchObject({ payslip_name: 'A' });
    }
    expect(() => ensureSuccess({ success: false }, 'Fallback text')).toThrow('Fallback text');
  });

  it('successBody returns the object body', () => {
    expect(successBody({ success: true, id: 1 }, 'x')).toEqual({ success: true, id: 1 });
    expect(successBody('plain', 'x')).toEqual({});
  });

  it('serverMessage prefers the server message', () => {
    expect(serverMessage({ message: ' Done ' }, 'fb')).toBe('Done');
    expect(serverMessage({}, 'fb')).toBe('fb');
  });

  it('resolveMimeType keeps a real mime type and guesses otherwise', () => {
    expect(resolveMimeType('image/png', 'a.bin')).toBe('image/png');
    expect(resolveMimeType(null, 'report.PDF')).toBe('application/pdf');
    expect(resolveMimeType('application/octet-stream', 'photo.jpeg')).toBe('image/jpeg');
    expect(resolveMimeType('', 'clip.mov')).toBe('video/quicktime');
    expect(resolveMimeType(undefined, 'noext')).toBe('application/octet-stream');
  });

  it('mapMessageType defaults to text', () => {
    expect(mapMessageType('IMAGE')).toBe('image');
    expect(mapMessageType('file')).toBe('file');
    expect(mapMessageType('sticker')).toBe('text');
    expect(mapMessageType(undefined)).toBe('text');
  });

  it('requireId trims and rejects blanks', () => {
    expect(requireId(' abc ', 'id')).toBe('abc');
    expect(() => requireId('  ', 'orgId')).toThrow('orgId is required');
    expect(() => requireId(undefined, 'orgId')).toThrow('orgId is required');
  });
});
