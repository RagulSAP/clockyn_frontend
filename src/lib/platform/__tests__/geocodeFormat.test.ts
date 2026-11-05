import { formatAddress } from '../geocodeFormat';

describe('formatAddress', () => {
  it('joins the available parts and skips empty ones (no ", ," gaps)', () => {
    expect(formatAddress({ name: '12', street: 'MG Road', city: 'Chennai', region: 'Tamil Nadu' })).toBe('12, MG Road, Chennai, Tamil Nadu');
    expect(formatAddress({ name: null, street: '', city: 'Chennai', region: 'Tamil Nadu' })).toBe('Chennai, Tamil Nadu');
  });
  it('collapses consecutive duplicates and returns null when nothing is usable', () => {
    expect(formatAddress({ name: 'MG Road', street: 'MG Road', city: 'Pune' })).toBe('MG Road, Pune');
    expect(formatAddress({})).toBeNull();
    expect(formatAddress({ name: '  ', street: undefined })).toBeNull();
  });
});
