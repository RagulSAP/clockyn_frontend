import { ApiError } from '../errors';
import { assertSuccess, isFailureBody, unwrapData, unwrapList } from '../envelope';

describe('envelope helpers', () => {
  it('isFailureBody detects success:false variants only', () => {
    expect(isFailureBody({ success: false })).toBe(true);
    expect(isFailureBody({ success: 0 })).toBe(true);
    expect(isFailureBody({ success: 'false' })).toBe(true);
    expect(isFailureBody({ success: true })).toBe(false);
    expect(isFailureBody({ message: 'x' })).toBe(false);
    expect(isFailureBody([])).toBe(false);
    expect(isFailureBody(null)).toBe(false);
  });

  it('assertSuccess throws ApiError with the server message', () => {
    expect(() => assertSuccess({ success: false, message: 'Already punched in' })).toThrow(ApiError);
    try {
      assertSuccess({ success: false, message: 'Already punched in' });
    } catch (e) {
      expect((e as ApiError).detail).toBe('Already punched in');
    }
    expect(() => assertSuccess({ success: false }, 'Could not save')).toThrow('Could not save');
    const ok = { success: true, message: 'ok' };
    expect(assertSuccess(ok)).toBe(ok);
  });

  it('unwrapData', () => {
    expect(unwrapData<number[]>({ success: true, data: [1] })).toEqual([1]);
    expect(unwrapData<string[]>({ success: true, sessions: ['a'] }, 'sessions')).toEqual(['a']);
    expect(unwrapData<{ a: number }>({ a: 1 })).toEqual({ a: 1 });
    expect(() => unwrapData({ success: false, message: 'nope' })).toThrow('nope');
  });

  it('unwrapList normalises bare arrays and envelopes and never returns null', () => {
    expect(unwrapList<number>([1, 2])).toEqual([1, 2]);
    expect(unwrapList<number>({ success: true, data: [3] })).toEqual([3]);
    expect(unwrapList<number>({ success: true, data: null })).toEqual([]);
    expect(unwrapList<number>(null)).toEqual([]);
    expect(unwrapList<number>({ success: true, sessions: [4] }, 'sessions')).toEqual([4]);
    expect(() => unwrapList({ success: false, message: 'bad' })).toThrow('bad');
  });
});
