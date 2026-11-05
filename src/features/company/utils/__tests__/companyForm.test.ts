import type { Company, CompanyDetails } from '@/types/api/company';

import {
  MSG_PINCODE,
  MSG_REQUIRED,
  buildCompanyInput,
  canDeleteCompany,
  canRequestEmailOtp,
  canRequestMobileOtp,
  cinError,
  contactNeedsVerification,
  emptyCompanyForm,
  formFromDetails,
  hasMoreDetails,
  listAdd,
  listRemove,
  listUpdate,
  nextActiveCompany,
  nonBlank,
  panError,
  tanError,
  validateCompanyForm,
  type CompanyFormValues,
} from '../companyForm';

const filled = (over: Partial<CompanyFormValues> = {}): CompanyFormValues => ({
  ...emptyCompanyForm(),
  name: 'Acme',
  address: '1 Main Road',
  state: 'Maharashtra',
  district: 'Pune',
  pincode: '411001',
  branches: ['HQ'],
  ...over,
});

describe('statutory id hints', () => {
  it('flags bad formats and clears on empty / valid values', () => {
    expect(panError('abc')).toBe('Invalid PAN format');
    expect(panError('ABCDE1234F')).toBe('');
    expect(panError('')).toBe('');
    expect(cinError('X')).toBe('Invalid CIN format');
    expect(cinError('U12345MH2020PTC123456')).toBe('');
    expect(tanError('PUNE12345A')).toBe('');
    expect(tanError('1234')).toBe('Invalid TAN format');
  });
});

describe('validateCompanyForm', () => {
  it('requires name, address, state, district, pincode and (add only) a branch', () => {
    expect(validateCompanyForm(filled({ name: ' ' }), 'add').message).toBe(MSG_REQUIRED);
    expect(validateCompanyForm(filled({ state: '' }), 'edit').message).toBe(MSG_REQUIRED);
    expect(validateCompanyForm(filled({ branches: ['', ' '] }), 'add').message).toBe(MSG_REQUIRED);
    expect(validateCompanyForm(filled(), 'add').message).toBeNull();
  });

  it('does not require a branch in edit mode (the list is hidden)', () => {
    expect(validateCompanyForm(filled({ branches: [''] }), 'edit').message).toBeNull();
  });

  it('requires a 6-digit pincode', () => {
    expect(validateCompanyForm(filled({ pincode: '4110' }), 'add')).toEqual({ message: MSG_PINCODE, fieldErrors: { pincode: MSG_PINCODE } });
    expect(validateCompanyForm(filled({ pincode: 'abc123' }), 'add').message).toBe(MSG_PINCODE);
  });

  it('does not block saving on PAN/CIN/TAN format problems (v1 behaviour)', () => {
    expect(validateCompanyForm(filled({ pan: 'bad', cin: 'bad', tan: 'bad' }), 'add').message).toBeNull();
  });
});

describe('buildCompanyInput', () => {
  it('add mode: non-blank branches, default department, empty legacy gst, numeric pincode', () => {
    const input = buildCompanyInput(filled({ branches: [' HQ ', '', 'Pune'], departments: [''], pan: 'abcde1234f', email: ' A@B.com ' }), { userId: 'u1', mode: 'add' });
    expect(input).toMatchObject({
      userId: 'u1',
      name: 'Acme',
      gst: '',
      branches: ['HQ', 'Pune'],
      departments: ['General'],
      pan: 'ABCDE1234F',
      email: 'a@b.com',
      pincode: 411001,
    });
  });

  it('edit mode: never sends branches, keeps the legacy gst and sends [] when no department is named', () => {
    const input = buildCompanyInput(filled({ branches: ['ignored'], departments: ['', ''] }), { userId: 'u1', mode: 'edit', legacyGst: 'LEG123' });
    expect(input.branches).toEqual([]);
    expect(input.departments).toEqual([]);
    expect(input.gst).toBe('LEG123');
  });

  it('trims every value', () => {
    const input = buildCompanyInput(filled({ name: '  Acme  ', address: ' Road ', state: ' MH ', district: ' Pune ', gstNumber: ' 27abcde1234f1z5 ' }), { userId: 'u', mode: 'add' });
    expect(input).toMatchObject({ name: 'Acme', address: 'Road', state: 'MH', district: 'Pune', gstNumber: '27ABCDE1234F1Z5' });
  });
});

describe('edit pre-fill and lists', () => {
  const details: CompanyDetails = {
    orgId: 'o1',
    name: 'Acme',
    address: 'Road',
    gst: 'LEG',
    raw: {},
    state: 'MH',
    district: 'Pune',
    pincode: 411001,
    mobile: '9876543210',
    email: 'Owner@Acme.com',
    pan: 'ABCDE1234F',
  };

  it('fills the form from the profile and department names', () => {
    const v = formFromDetails(details, ['Sales', 'Ops']);
    expect(v).toMatchObject({ name: 'Acme', pincode: '411001', email: 'owner@acme.com', departments: ['Sales', 'Ops'], pan: 'ABCDE1234F' });
    expect(formFromDetails(details, []).departments).toEqual(['']);
    expect(hasMoreDetails(v)).toBe(true);
    expect(hasMoreDetails(emptyCompanyForm())).toBe(false);
  });

  it('adds, updates and removes list rows but never removes the last one', () => {
    expect(listAdd(['a'])).toEqual(['a', '']);
    expect(listUpdate(['a', 'b'], 1, 'x')).toEqual(['a', 'x']);
    expect(listRemove(['a', 'b'], 0)).toEqual(['b']);
    expect(listRemove(['a'], 0)).toEqual(['a']);
    expect(nonBlank([' a ', '', ' '])).toEqual(['a']);
  });
});

describe('OTP rules', () => {
  it('offers "Get OTP" for a changed full mobile number / email', () => {
    expect(canRequestMobileOtp('9876543210', '')).toBe(true);
    expect(canRequestMobileOtp('9876543210', '9876543210')).toBe(false);
    expect(canRequestMobileOtp('98765', '')).toBe(false);
    expect(canRequestEmailOtp('a@b.com', '')).toBe(true);
    expect(canRequestEmailOtp('a@b.com', 'a@b.com')).toBe(false);
    expect(canRequestEmailOtp('nope', '')).toBe(false);
  });

  it('requires verification only in edit mode for a changed, non-empty, unverified contact', () => {
    expect(contactNeedsVerification('edit', '9111111111', '9222222222', false)).toBe(true);
    expect(contactNeedsVerification('edit', '9111111111', '9222222222', true)).toBe(false);
    expect(contactNeedsVerification('edit', '9222222222', '9222222222', false)).toBe(false);
    expect(contactNeedsVerification('edit', '', '9222222222', false)).toBe(false);
    expect(contactNeedsVerification('add', '9111111111', '', false)).toBe(false);
  });
});

describe('delete rules', () => {
  const company = (orgId: string): Company => ({ orgId, name: `Company ${orgId}`, address: '', gst: '', raw: {} });

  it('offers delete only when more than one company exists', () => {
    expect(canDeleteCompany(1)).toBe(false);
    expect(canDeleteCompany(2)).toBe(true);
  });

  it('switches to the first remaining company when the active one was deleted', () => {
    expect(nextActiveCompany([company('b'), company('c')], 'a', 'a')?.orgId).toBe('b');
  });

  it('keeps the current company when another one was deleted', () => {
    expect(nextActiveCompany([company('a'), company('c')], 'b', 'a')).toBeNull();
  });

  it('switches when the active company is no longer among the remaining ones, and never with none left', () => {
    expect(nextActiveCompany([company('c')], 'b', 'zzz')?.orgId).toBe('c');
    expect(nextActiveCompany([], 'a', 'a')).toBeNull();
  });
});
