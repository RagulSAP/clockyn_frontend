/**
 * Pure logic of the company registration form: required-field rules, list clean-up and the `POST /auth/register` input.
 * Statutory identifiers (GST / PAN / CIN / TAN) are validated for display only — they never block the submit (v1 rule).
 */
import type { RegisterCompanyInput } from '@/types/api/auth';

import { INVALID_PIN_MESSAGE, isValidMobile, isValidPincode } from './validation';

export interface RegisterValues {
  orgName: string;
  address: string;
  state: string;
  district: string;
  pincode: string;
  gst: string;
  branches: string[];
  departments: string[];
  pan: string;
  website: string;
  cin: string;
  tan: string;
  msme: string;
  businessCategory: string;
}

export const initialRegisterValues: RegisterValues = {
  orgName: '',
  address: '',
  state: '',
  district: '',
  pincode: '',
  gst: '',
  branches: [''],
  departments: [''],
  pan: '',
  website: '',
  cin: '',
  tan: '',
  msme: '',
  businessCategory: '',
};

export const DEFAULT_BRANCH = 'Main Branch';
export const DEFAULT_DEPARTMENT = 'General';

/** Trim, drop blanks and remove case-insensitive duplicates (v1 sent them untrimmed and duplicated). */
export function cleanNames(list: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const name = raw.trim();
    if (name === '') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export type RequiredField = 'orgName' | 'address' | 'state' | 'district' | 'pincode' | 'branches';

export interface RegisterContactState {
  mobile: string;
  mobileVerified: boolean;
  emailVerified: boolean;
}

/** Messages of the blocking inline errors, keyed by field (only fields that currently fail). */
export function requiredErrors(values: RegisterValues): Partial<Record<RequiredField, string>> {
  const errors: Partial<Record<RequiredField, string>> = {};
  if (values.orgName.trim() === '') errors.orgName = 'Company name is required';
  if (values.address.trim() === '') errors.address = 'Company address is required';
  if (values.state.trim() === '') errors.state = 'State is required';
  if (values.district.trim() === '') errors.district = 'District is required';
  if (values.pincode.trim() === '') errors.pincode = 'Pincode is required';
  else if (!isValidPincode(values.pincode)) errors.pincode = INVALID_PIN_MESSAGE;
  if (cleanNames(values.branches).length === 0) errors.branches = 'Add at least one branch';
  return errors;
}

/** True when every required field is valid and both contacts are verified (enables the Register button). */
export function isRegisterReady(values: RegisterValues, contact: RegisterContactState): boolean {
  return (
    Object.keys(requiredErrors(values)).length === 0 &&
    isValidMobile(contact.mobile) &&
    contact.mobileVerified &&
    contact.emailVerified
  );
}

/** The registration request (v1 payload quirks live in `toRegisterBody`: GST goes out twice, optional ids only when set). */
export function buildRegisterInput(
  values: RegisterValues,
  contact: { mobile: string; email: string; deviceToken?: string | null; referralCode?: string },
): RegisterCompanyInput {
  const orgName = values.orgName.trim();
  const branches = cleanNames(values.branches);
  const departments = cleanNames(values.departments);
  const opt = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
  return {
    name: orgName,
    empId: '',
    mobile: contact.mobile,
    email: contact.email,
    orgName,
    orgAddress: values.address.trim(),
    gst: values.gst.trim(),
    branches: branches.length > 0 ? branches : [DEFAULT_BRANCH],
    departments: departments.length > 0 ? departments : [DEFAULT_DEPARTMENT],
    pan: opt(values.pan),
    website: opt(values.website),
    cin: opt(values.cin),
    tan: opt(values.tan),
    msme: opt(values.msme),
    businessCategory: opt(values.businessCategory),
    deviceToken: contact.deviceToken ?? undefined,
    state: values.state.trim(),
    district: values.district.trim(),
    pincode: parseInt(values.pincode, 10),
    referralCode: contact.referralCode ? contact.referralCode : undefined,
  };
}
