import { isHttpUrl } from '../safeUrl';

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('https://cdn.example.com/a.mp4')).toBe(true);
    expect(isHttpUrl('HTTP://example.com')).toBe(true);
  });

  it('rejects other schemes, relative paths and empty values', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('intent://scan/#Intent;end')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('//example.com')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });
});
