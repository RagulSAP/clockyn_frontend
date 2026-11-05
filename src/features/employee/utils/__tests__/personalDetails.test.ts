import type { EmployeePersonalDetails } from '@/types/api/employee';

import {
  EMPTY_DRAFT,
  fieldError,
  hasUnsavedChanges,
  issuesMessage,
  optionsWithCurrent,
  sanitizeInput,
  toDraft,
  toUpdateInput,
  validateChanged,
} from '../personalDetails';

const details: EmployeePersonalDetails = {
  userId: 'u1',
  name: 'Asha',
  empId: 'E1',
  mobile: '9876543210',
  email: 'a@x.in',
  branchName: 'HQ',
  deptName: 'Ops',
  roleName: 'Staff',
  dob: '1990-05-17',
  panNo: 'ABCDE1234F',
  raw: {},
};

describe('sanitizeInput', () => {
  it('upper-cases PAN and IFSC, strips non-digits from numeric ids and caps the length', () => {
    expect(sanitizeInput('pan', 'abcde1234f')).toBe('ABCDE1234F');
    expect(sanitizeInput('ifsc', 'sbin0001234')).toBe('SBIN0001234');
    expect(sanitizeInput('aadhaar', '12a34-5678 9012 3456')).toBe('123456789012');
    expect(sanitizeInput('mobile', '98765 43210 99')).toBe('9876543210');
    expect(sanitizeInput('pf', 'AB/12345678901234567890123456')).toHaveLength(25);
    expect(sanitizeInput('name', 'Asha K')).toBe('Asha K');
  });
});

describe('fieldError', () => {
  it('accepts empty values and valid patterns', () => {
    expect(fieldError('aadhaar', '')).toBe('');
    expect(fieldError('aadhaar', '123456789012')).toBe('');
    expect(fieldError('pan', 'ABCDE1234F')).toBe('');
    expect(fieldError('pf', 'MH/BAN/12345')).toBe('');
    expect(fieldError('esi', '12345678901234567')).toBe('');
  });
  it('returns the v1 hint for invalid values', () => {
    expect(fieldError('aadhaar', '1234')).toBe('12-digit number');
    expect(fieldError('pan', 'ABC')).toBe('e.g. ABCDE1234F');
    expect(fieldError('mobile', '5123456789')).toBe('10-digit number starting 6-9');
    expect(fieldError('emergencyContact', '1234567890')).toBe('10-digit number starting 6-9');
    expect(fieldError('esi', '123')).toBe('17-digit number');
    expect(fieldError('pf', 'a b')).toBe('Alphanumeric with / allowed');
  });
});

describe('validateChanged', () => {
  const saved = toDraft(details);
  it('reports changed invalid fields in validation order with readable labels', () => {
    const draft = { ...saved, mobile: '5123456789', aadhaar: '12', emergencyContact: '1' };
    const issues = validateChanged(draft, saved);
    expect(issues.map((i) => i.key)).toEqual(['aadhaar', 'mobile', 'emergencyContact']);
    expect(issuesMessage(issues)).toBe(
      'Aadhaar No: 12-digit number\nMobile: 10-digit number starting 6-9\nEmergency Contact: 10-digit number starting 6-9',
    );
  });
  it('does not let an untouched legacy value block unrelated edits (v1 did)', () => {
    const legacy = { ...saved, mobile: '12345' };
    expect(validateChanged({ ...legacy, address: 'New street' }, legacy)).toEqual([]);
  });
});

describe('draft mapping', () => {
  it('maps the details to a draft and back to the update payload', () => {
    const draft = toDraft(details);
    expect(draft.pan).toBe('ABCDE1234F');
    expect(draft.dob).toBe('1990-05-17');
    expect(draft.gender).toBe('');
    const input = toUpdateInput({ ...draft, doj: '' });
    expect(input).toMatchObject({ name: 'Asha', panNo: 'ABCDE1234F', dob: '1990-05-17', doj: '' });
    expect(toDraft(undefined)).toEqual(EMPTY_DRAFT);
  });
  it('detects unsaved changes including a pending photo', () => {
    const saved = toDraft(details);
    expect(hasUnsavedChanges(saved, saved, false)).toBe(false);
    expect(hasUnsavedChanges({ ...saved, name: 'Asha K' }, saved, false)).toBe(true);
    expect(hasUnsavedChanges(saved, saved, true)).toBe(true);
  });
  it('keeps a legacy free-text value selectable', () => {
    expect(optionsWithCurrent(['Male', 'Female'], 'male').map((o) => o.value)).toEqual(['Male', 'Female', 'male']);
    expect(optionsWithCurrent(['Male', 'Female'], 'Male')).toHaveLength(2);
  });
});
