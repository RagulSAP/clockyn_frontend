import type { StaffRecord } from '@/types/api/staff';

import {
  EMPTY_STAFF_FORM,
  digitsOnly,
  formFromRecord,
  hasMoreDetails,
  isStaffFormDirty,
  parseStaffLimit,
  staffLimitReached,
  staffLimitSubtitle,
  staffLimitTitle,
  toStaffInput,
  validateStaffForm,
  type StaffFormValues,
} from '../staffForm';

const valid: StaffFormValues = {
  ...EMPTY_STAFF_FORM,
  name: 'Asha Verma',
  empId: '1001',
  phone: '9876543210',
  branchName: 'Head Office',
  deptName: 'Sales',
  gender: 'Female',
};

describe('validateStaffForm', () => {
  it('reports every missing required field with the v1 messages', () => {
    expect(validateStaffForm(EMPTY_STAFF_FORM)).toEqual({
      name: 'Please input full name',
      empId: 'Please input employee ID',
      phone: 'Please input phone number',
      branchName: 'Please input branch name',
      deptName: 'Please input department name',
      gender: 'Please select gender',
    });
  });

  it('treats whitespace as empty and accepts a complete form without email / shift', () => {
    expect(validateStaffForm({ ...valid, name: '   ' })).toEqual({ name: 'Please input full name' });
    expect(validateStaffForm(valid)).toEqual({});
  });

  it('e-mail sign-in deployments require a valid email', () => {
    expect(validateStaffForm(valid, { emailRequired: true })).toEqual({ email: 'Please input email address' });
    expect(validateStaffForm({ ...valid, email: 'nope' }, { emailRequired: true })).toEqual({ email: 'Enter a valid email address' });
    expect(validateStaffForm({ ...valid, email: 'asha@example.com' }, { emailRequired: true })).toEqual({});
    expect(validateStaffForm({ ...valid, email: 'nope' })).toEqual({}); // optional otherwise
  });

  it('e-mail sign-in deployments make the phone number optional (email is mandatory instead)', () => {
    const noPhone = { ...valid, phone: '', email: 'asha@example.com' };
    expect(validateStaffForm(noPhone, { emailRequired: true })).toEqual({});
    expect(validateStaffForm({ ...noPhone, email: '' }, { emailRequired: true })).toEqual({ email: 'Please input email address' });
    expect(validateStaffForm(noPhone)).toEqual({ phone: 'Please input phone number' }); // mobile sign-in still needs it
  });
});

describe('input helpers', () => {
  it('keeps digits only, optionally capped', () => {
    expect(digitsOnly('98a76-54 3210 99', 10)).toBe('9876543210');
    expect(digitsOnly('12 34')).toBe('1234');
  });
});

describe('isStaffFormDirty', () => {
  it('is false without a snapshot and when nothing changed (photo included)', () => {
    expect(isStaffFormDirty(valid, null, null, null)).toBe(false);
    expect(isStaffFormDirty(valid, valid, 'http://x/p.png', 'http://x/p.png')).toBe(false);
  });
  it('detects field and photo changes', () => {
    expect(isStaffFormDirty({ ...valid, name: 'Asha V' }, valid, null, null)).toBe(true);
    expect(isStaffFormDirty(valid, valid, 'file:///new.jpg', null)).toBe(true);
    expect(isStaffFormDirty(valid, valid, null, 'http://x/p.png')).toBe(true);
  });
});

describe('payload mapping', () => {
  it('sends branch / department by name, 0 for no shift and no manager id', () => {
    const input = toStaffInput({ ...valid, accNo: '123', ifsc: 'ABCD0123456' }, 'org-1');
    expect(input).toMatchObject({
      orgId: 'org-1',
      name: 'Asha Verma',
      empId: '1001',
      mobile: '9876543210',
      branchName: 'Head Office',
      departmentName: 'Sales',
      shiftId: 0,
      isFieldStaff: false,
      bankAccountNo: '123',
      ifsc: 'ABCD0123456',
    });
    expect(input.managerId).toBeUndefined();
  });

  it('prefills edit mode from the record and opens More Details when extras exist', () => {
    const record = {
      name: 'Ravi',
      empId: '77',
      mobile: '9000000001',
      email: 'r@x.in',
      branch: 'Pune',
      department: 'Ops',
      gender: 'Male',
      shiftId: 4,
      isFieldStaff: true,
      dob: '1990-05-01',
      bankAccountNo: '555',
      ifsc: 'IFSC1',
      isActive: true,
    } as unknown as StaffRecord;
    const form = formFromRecord(record);
    expect(form).toMatchObject({ name: 'Ravi', phone: '9000000001', branchName: 'Pune', deptName: 'Ops', shiftId: 4, isFieldStaff: true, dob: '1990-05-01', accNo: '555' });
    expect(hasMoreDetails(form)).toBe(true);
    expect(hasMoreDetails(valid)).toBe(false);
  });
});

describe('staff limit', () => {
  it('parses staff_limit like v1 (missing or 0 -> no limit info)', () => {
    expect(parseStaffLimit({ staff_limit: 25 })).toBe(25);
    expect(parseStaffLimit({ staff_limit: '10' })).toBe(10);
    expect(parseStaffLimit({ staff_limit: 0 })).toBe(0);
    expect(parseStaffLimit({})).toBe(0);
    expect(parseStaffLimit(undefined)).toBe(0);
  });

  it('reaches the limit at current >= limit and words the banner with singular / plural', () => {
    expect(staffLimitReached({ current: 10, limit: 10 })).toBe(true);
    expect(staffLimitReached({ current: 11, limit: 10 })).toBe(true);
    expect(staffLimitReached({ current: 9, limit: 10 })).toBe(false);
    expect(staffLimitReached(null)).toBe(false);
    expect(staffLimitTitle({ current: 3, limit: 10 })).toBe('Staff: 3 / 10');
    expect(staffLimitSubtitle({ current: 9, limit: 10 })).toBe('1 slot remaining');
    expect(staffLimitSubtitle({ current: 5, limit: 10 })).toBe('5 slots remaining');
    expect(staffLimitSubtitle({ current: 10, limit: 10 })).toBe('Staff limit reached. Please upgrade your plan to add more.');
  });
});
