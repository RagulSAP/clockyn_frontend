import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
  apiErrorFromResponse,
  businessError,
  extractBodyMessage,
  extractDetailMessage,
  getErrorMessage,
  networkError,
  parseWrappedDetail,
  timeoutError,
} from '../errors';

describe('extractDetailMessage', () => {
  it('handles strings', () => {
    expect(extractDetailMessage('Invalid OTP format')).toBe('Invalid OTP format');
    expect(extractDetailMessage('   ')).toBeUndefined();
  });
  it('handles FastAPI validation arrays', () => {
    expect(
      extractDetailMessage([
        { loc: ['query', 'org_id'], msg: 'Field required', type: 'missing' },
        { loc: ['body', 'email'], msg: 'Value error, bad email' },
        { loc: ['query', 'org_id'], msg: 'Field required' },
      ]),
    ).toBe('Field required. bad email');
    expect(extractDetailMessage([])).toBeUndefined();
    expect(extractDetailMessage(['plain'])).toBe('plain');
  });
  it('handles objects', () => {
    expect(extractDetailMessage({ message: 'nested message' })).toBe('nested message');
    expect(extractDetailMessage({ error: 'x' })).toBe('x');
    expect(extractDetailMessage({ code: 12 })).toBeUndefined();
  });
  it('ignores other types', () => {
    expect(extractDetailMessage(12)).toBeUndefined();
    expect(extractDetailMessage(null)).toBeUndefined();
  });
});

describe('extractBodyMessage', () => {
  it('prefers detail over message', () => {
    expect(extractBodyMessage({ detail: 'd', message: 'm' })).toBe('d');
    expect(extractBodyMessage({ message: 'm' })).toBe('m');
    expect(extractBodyMessage({ success: false })).toBeUndefined();
  });
  it('accepts short plain text but not HTML', () => {
    expect(extractBodyMessage('Bad gateway')).toBe('Bad gateway');
    expect(extractBodyMessage('<html>oops</html>')).toBeUndefined();
    expect(extractBodyMessage('x'.repeat(500))).toBeUndefined();
    expect(extractBodyMessage(null)).toBeUndefined();
  });
});

describe('parseWrappedDetail', () => {
  it('parses "403: message"', () => {
    expect(parseWrappedDetail('403: Your plan has expired.')).toEqual({ status: 403, message: 'Your plan has expired.' });
  });
  it('unwraps nested wrappers and multi-line messages', () => {
    expect(parseWrappedDetail('500: 403: nested')).toEqual({ status: 403, message: 'nested' });
    expect(parseWrappedDetail('404: line1\nline2')).toEqual({ status: 404, message: 'line1\nline2' });
  });
  it('ignores non-error codes and plain text', () => {
    expect(parseWrappedDetail('200: ok')).toBeNull();
    expect(parseWrappedDetail('Something failed')).toBeNull();
    expect(parseWrappedDetail('12: nope')).toBeNull();
  });
});

describe('apiErrorFromResponse', () => {
  it('uses detail for 4xx', () => {
    const e = apiErrorFromResponse(400, { detail: 'Invalid OTP format' });
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(400);
    expect(e.message).toBe('Invalid OTP format');
    expect(e.detail).toBe('Invalid OTP format');
    expect(e.isNetwork).toBe(false);
    expect(e.wrapped).toBe(false);
    expect(e.raw).toEqual({ detail: 'Invalid OTP format' });
    expect(e.name).toBe('ApiError');
  });
  it('falls back to message and then to a generic text', () => {
    expect(apiErrorFromResponse(400, { message: 'm' }).message).toBe('m');
    const none = apiErrorFromResponse(404, {});
    expect(none.message).toBe('Request failed');
    expect(none.detail).toBeUndefined();
    expect(apiErrorFromResponse(503, null).message).toBe('Server error. Please try again later.');
  });
  it('joins validation arrays (422)', () => {
    const e = apiErrorFromResponse(422, { detail: [{ loc: ['query', 'a'], msg: 'Field required' }] });
    expect(e.status).toBe(422);
    expect(e.message).toBe('Field required');
  });
  it('unwraps HTTP 500 "403: message" into status 403', () => {
    const e = apiErrorFromResponse(500, { detail: '403: Your plan has expired. Please renew.' });
    expect(e.status).toBe(403);
    expect(e.message).toBe('Your plan has expired. Please renew.');
    expect(e.detail).toBe('Your plan has expired. Please renew.');
    expect(e.wrapped).toBe(true);
    expect(e.isForbidden).toBe(true);
  });
  it('does not unwrap a genuine 500 or a non-500 status', () => {
    const a = apiErrorFromResponse(500, { detail: 'database exploded' });
    expect(a.status).toBe(500);
    expect(a.wrapped).toBe(false);
    expect(a.isServerError).toBe(true);
    const b = apiErrorFromResponse(400, { detail: '403: not wrapped' });
    expect(b.status).toBe(400);
    expect(b.message).toBe('403: not wrapped');
  });
});

describe('network / timeout / business errors', () => {
  it('flags network errors', () => {
    const e = networkError();
    expect(e.isNetwork).toBe(true);
    expect(e.status).toBe(0);
    expect(e.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(e.isTimeout).toBe(false);
  });
  it('timeouts are network errors with isTimeout', () => {
    const e = timeoutError();
    expect(e.isNetwork).toBe(true);
    expect(e.isTimeout).toBe(true);
    expect(e.message).toBe(TIMEOUT_ERROR_MESSAGE);
  });
  it('businessError carries the server message', () => {
    const e = businessError({ success: false, message: 'Already punched in' });
    expect(e.status).toBe(200);
    expect(e.detail).toBe('Already punched in');
    expect(businessError({ success: false }, 'Could not save').message).toBe('Could not save');
  });
});

describe('getErrorMessage', () => {
  it('prefers the server detail', () => {
    expect(getErrorMessage(apiErrorFromResponse(400, { detail: 'Mobile number already registered' }), 'Failed')).toBe(
      'Mobile number already registered',
    );
  });
  it('uses the fallback when the server gave nothing', () => {
    expect(getErrorMessage(apiErrorFromResponse(404, {}), 'Failed to load branches')).toBe('Failed to load branches');
    expect(getErrorMessage(apiErrorFromResponse(404, {}))).toBe('Request failed');
  });
  it('network errors keep their own message even with a fallback', () => {
    expect(getErrorMessage(networkError(), 'Failed')).toBe(NETWORK_ERROR_MESSAGE);
    expect(getErrorMessage(timeoutError(), 'Failed')).toBe(TIMEOUT_ERROR_MESSAGE);
  });
  it('hides engine TypeErrors behind the fallback', () => {
    expect(getErrorMessage(new TypeError('undefined is not an object'), 'Failed')).toBe('Failed');
  });
  it('passes through plain Error messages and strings', () => {
    expect(getErrorMessage(new Error('Enter a valid amount'), 'Failed')).toBe('Enter a valid amount');
    expect(getErrorMessage('Oops', 'Failed')).toBe('Oops');
    expect(getErrorMessage(new Error(''), 'Failed')).toBe('Failed');
  });
  it('understands axios-like objects', () => {
    expect(getErrorMessage({ response: { data: { detail: 'Employee not found' } } }, 'Failed')).toBe('Employee not found');
    expect(getErrorMessage({ message: 'plain object' }, 'Failed')).toBe('plain object');
  });
  it('falls back for unknown values', () => {
    expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(getErrorMessage(null, 'Failed')).toBe('Failed');
    expect(getErrorMessage(42, 'Failed')).toBe('Failed');
  });
});
