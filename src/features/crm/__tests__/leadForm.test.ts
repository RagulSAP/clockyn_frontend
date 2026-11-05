import { buildLeadBody, leadToInput } from '@/api/leads';

import { EMPTY_LEAD_FORM, LEAD_MESSAGES, leadToFormValues, sanitizeMobile, toCreateInput, toUpdateInput, validateLeadForm, type LeadFormValues } from '../utils/leadForm';
import { filterCategories } from '../utils/categories';
import { lead } from './fixtures';

const valid: LeadFormValues = { name: 'Acme Corp', mobile: '9876543210', address: '1 High St', category: 'Retail', remarks: '', requiredDate: '' };

describe('lead form validation', () => {
  it('requires name, mobile, address and category (trimmed) with the v1 messages', () => {
    const r = validateLeadForm({ ...EMPTY_LEAD_FORM, name: '   ' }, 'admin');
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Please fill all required fields');
    expect(Object.keys(r.fields).sort()).toEqual(['address', 'category', 'mobile', 'name']);
    expect(validateLeadForm({ ...valid, category: '' }, 'staff').message).toBe('Please fill all required fields.');
  });

  it('requires exactly 10 digits for the mobile number', () => {
    expect(validateLeadForm({ ...valid, mobile: '98765' }, 'admin').message).toBe(LEAD_MESSAGES.admin.mobile);
    expect(validateLeadForm({ ...valid, mobile: '98765' }, 'staff').message).toBe('Mobile number must be 10 digits.');
    expect(validateLeadForm({ ...valid, mobile: '98765abcde' }, 'admin').ok).toBe(false);
    expect(validateLeadForm(valid, 'admin')).toEqual({ ok: true, message: '', fields: {} });
  });

  it('keeps digits only, max 10, when typing', () => {
    expect(sanitizeMobile('98a76-54 32109999')).toBe('9876543210');
  });
});

describe('lead payload builders', () => {
  it('create payload: trimmed values, null required date when empty', () => {
    const body = buildLeadBody(toCreateInput({ ...valid, name: '  Acme Corp  ' }, 'org1'));
    expect(body).toEqual({ org_id: 'org1', name: 'Acme Corp', mobile: '9876543210', address: '1 High St', category: 'Retail', remarks: '', required_date: null });
  });

  it('edit round-trip keeps the required date (v1 blanked it)', () => {
    const existing = lead({ id: 'L1', clientName: 'Acme', requiredDate: '2026-11-05', categoryName: 'Retail', address: '1 High St' });
    const form = leadToFormValues(existing);
    expect(form.requiredDate).toBe('2026-11-05');
    const body = buildLeadBody(toUpdateInput(form, 'org1'));
    expect(body.required_date).toBe('2026-11-05');
    expect(leadToInput(existing, 'org1').requiredDate).toBe('2026-11-05');
  });

  it('clearing the date on edit sends null explicitly', () => {
    const existing = lead({ id: 'L1', requiredDate: '2026-11-05' });
    const form = { ...leadToFormValues(existing), requiredDate: '' };
    expect(toUpdateInput(form, 'org1').requiredDate).toBeNull();
  });

  it('a lead without a required date opens with an empty date field', () => {
    expect(leadToFormValues(lead({ id: 'L2' })).requiredDate).toBe('');
  });
});

describe('category search', () => {
  const cats = [
    { id: '1', name: 'Retail' },
    { id: '2', name: 'Real Estate' },
    { id: '3', name: 'Finance' },
  ];
  it('is a case-insensitive substring match', () => {
    expect(filterCategories(cats, 're').map((c) => c.id)).toEqual(['1', '2']);
    expect(filterCategories(cats, 'FIN')).toHaveLength(1);
    expect(filterCategories(cats, '  ')).toHaveLength(3);
    expect(filterCategories(cats, 'zzz')).toHaveLength(0);
  });
});
