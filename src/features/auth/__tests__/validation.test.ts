import {
  cinError,
  digitsOnly,
  emailError,
  gstError,
  isValidEmail,
  isValidLoginId,
  isValidMobile,
  isValidPincode,
  normalizeEmail,
  normalizeStatutoryId,
  panError,
  pincodeError,
  tanError,
} from '../utils/validation';

describe('mobile', () => {
  it('accepts exactly 10 digits', () => {
    expect(isValidMobile('9876543210')).toBe(true);
    expect(isValidMobile('987654321')).toBe(false);
    expect(isValidMobile('98765432101')).toBe(false);
    expect(isValidMobile('98765abcde')).toBe(false);
    expect(isValidMobile('+919876543210')).toBe(false);
  });

  it('digitsOnly strips non-digits and caps the length', () => {
    expect(digitsOnly('98a76-54 3210999', 10)).toBe('9876543210');
    expect(digitsOnly('12ab34')).toBe('1234');
  });
});

describe('email', () => {
  it('requires name@domain.tld', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail(' owner@company.in ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a@')).toBe(false);
    expect(isValidEmail('plain')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });

  it('normalises to trimmed lower case and reports a message only for non-empty invalid values', () => {
    expect(normalizeEmail('  Owner@Company.IN ')).toBe('owner@company.in');
    expect(emailError('')).toBe('');
    expect(emailError('bad')).toBe('Enter a valid email address');
    expect(emailError('ok@x.io')).toBe('');
  });
});

describe('pincode', () => {
  it('is 6 digits', () => {
    expect(isValidPincode('560001')).toBe(true);
    expect(isValidPincode('56000')).toBe(false);
    expect(isValidPincode('5600011')).toBe(false);
    expect(isValidPincode('56a001')).toBe(false);
    expect(pincodeError('123')).toBe('Enter a valid 6-digit pincode');
    expect(pincodeError('')).toBe('');
  });
});

describe('statutory identifiers (empty is fine)', () => {
  it('PAN', () => {
    expect(panError('')).toBe('');
    expect(panError('ABCDE1234F')).toBe('');
    expect(panError('abcde1234f')).toBe('Invalid PAN format (e.g., ABCDE1234F)');
    expect(panError('ABCDE12345')).toBe('Invalid PAN format (e.g., ABCDE1234F)');
  });

  it('CIN', () => {
    expect(cinError('')).toBe('');
    expect(cinError('U12345MH2020PTC123456')).toBe('');
    expect(cinError('X12345MH2020PTC123456')).toBe('Invalid CIN format');
  });

  it('TAN', () => {
    expect(tanError('ABCD12345E')).toBe('');
    expect(tanError('ABC123456E')).toBe('Invalid TAN format (e.g., ABCD12345E)');
  });

  it('GST', () => {
    expect(gstError('')).toBe('');
    expect(gstError('22AAAAA0000A1Z5')).toBe('');
    expect(gstError('22AAAAA0000A1X5')).toContain('Invalid GST');
    expect(gstError('22AAAAA0000A1Z')).toContain('Invalid GST');
  });

  it('normalizeStatutoryId upper-cases and removes spaces', () => {
    expect(normalizeStatutoryId(' abcde 1234f ')).toBe('ABCDE1234F');
  });
});

describe('isValidLoginId', () => {
  it('otp mode needs a 10-digit mobile number, email mode needs an e-mail address', () => {
    expect(isValidLoginId('otp', '9876543210')).toBe(true);
    expect(isValidLoginId('otp', 'a@b.co')).toBe(false);
    expect(isValidLoginId('email', 'a@b.co')).toBe(true);
    expect(isValidLoginId('email', '9876543210')).toBe(false);
    expect(isValidLoginId('email', '')).toBe(false);
  });
});
