import { toRegisterBody } from '@/api/mappers/auth';

import { buildRegisterInput, cleanNames, initialRegisterValues, isRegisterReady, requiredErrors, type RegisterValues } from '../utils/registerForm';

const filled: RegisterValues = {
  ...initialRegisterValues,
  orgName: ' Acme Pvt Ltd ',
  address: '12 MG Road',
  state: 'Karnataka',
  district: 'Bengaluru',
  pincode: '560001',
  branches: ['Head Office'],
};
const verified = { mobile: '9876543210', mobileVerified: true, emailVerified: true };

describe('cleanNames', () => {
  it('trims, drops blanks and removes case-insensitive duplicates', () => {
    expect(cleanNames([' HQ ', '', '  ', 'hq', 'Branch 2'])).toEqual(['HQ', 'Branch 2']);
  });
});

describe('requiredErrors / isRegisterReady', () => {
  it('flags every missing required field', () => {
    expect(Object.keys(requiredErrors(initialRegisterValues)).sort()).toEqual(['address', 'branches', 'district', 'orgName', 'pincode', 'state']);
  });

  it('requires a 6-digit pincode and a non-blank branch', () => {
    expect(requiredErrors({ ...filled, pincode: '5600' }).pincode).toBe('Enter a valid 6-digit pincode');
    expect(requiredErrors({ ...filled, branches: ['  ', ''] }).branches).toBeDefined();
    expect(requiredErrors(filled)).toEqual({});
  });

  it('is ready only with valid fields and both contacts verified', () => {
    expect(isRegisterReady(filled, verified)).toBe(true);
    expect(isRegisterReady(filled, { ...verified, emailVerified: false })).toBe(false);
    expect(isRegisterReady(filled, { ...verified, mobileVerified: false })).toBe(false);
    expect(isRegisterReady(filled, { ...verified, mobile: '98765' })).toBe(false);
    expect(isRegisterReady({ ...filled, address: '' }, verified)).toBe(false);
  });

  it('statutory ids never block the submit', () => {
    expect(isRegisterReady({ ...filled, pan: 'bad', cin: 'bad', tan: 'bad', gst: 'bad' }, verified)).toBe(true);
  });
});

describe('buildRegisterInput', () => {
  it('builds the v1 payload (names trimmed, defaults, integer pincode)', () => {
    const input = buildRegisterInput({ ...filled, gst: '22AAAAA0000A1Z5', departments: [''], pan: 'ABCDE1234F', website: ' ' }, { mobile: '9876543210', email: 'a@b.co', deviceToken: 'dev-1' });
    expect(input).toMatchObject({
      name: 'Acme Pvt Ltd',
      orgName: 'Acme Pvt Ltd',
      orgAddress: '12 MG Road',
      empId: '',
      branches: ['Head Office'],
      departments: ['General'],
      deviceToken: 'dev-1',
      state: 'Karnataka',
      district: 'Bengaluru',
      pincode: 560001,
      pan: 'ABCDE1234F',
      website: undefined,
    });

    const body = toRegisterBody(input);
    expect(body).toMatchObject({ org_gst: '22AAAAA0000A1Z5', gst_number: '22AAAAA0000A1Z5', mobile_number: '9876543210', pincode: 560001, device_token: 'dev-1' });
    expect(body).not.toHaveProperty('company_website');
  });

  it('omits the device token when the user did not come from the login screen', () => {
    const body = toRegisterBody(buildRegisterInput(filled, { mobile: '9876543210', email: 'a@b.co', deviceToken: null }));
    expect(body).not.toHaveProperty('device_token');
  });
});
