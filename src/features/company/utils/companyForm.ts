/**
 * Pure logic of the add / edit company form: statutory-ID validators, required-field rules, the API payload builder,
 * repeatable-list helpers, OTP eligibility rules and the "which company becomes active after a delete" rule.
 */
import type { Company, CompanyDetails, CompanyInput } from '@/types/api/company';

export type CompanyMode = 'add' | 'edit';

// ─── statutory IDs ──────────────────────────────────────────────────────────────────────────

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;

/** Inline format hints. Display-only: like v1 they never block saving (kept on purpose, see the change log). */
export const panError = (v: string): string => (v !== '' && !PAN_RE.test(v) ? 'Invalid PAN format' : '');
export const cinError = (v: string): string => (v !== '' && !CIN_RE.test(v) ? 'Invalid CIN format' : '');
export const tanError = (v: string): string => (v !== '' && !TAN_RE.test(v) ? 'Invalid TAN format' : '');

export const MAX_LENGTH = { pan: 10, cin: 21, tan: 10, gst: 15, pincode: 6, mobile: 10, otp: 6 } as const;

// ─── form state ─────────────────────────────────────────────────────────────────────────────

export type CompanyFormValues = {
  name: string;
  address: string;
  state: string;
  district: string;
  pincode: string;
  gstNumber: string;
  mobile: string;
  email: string;
  branches: string[];
  departments: string[];
  pan: string;
  website: string;
  cin: string;
  tan: string;
  msme: string;
  businessCategory: string;
};

export function emptyCompanyForm(): CompanyFormValues {
  return {
    name: '',
    address: '',
    state: '',
    district: '',
    pincode: '',
    gstNumber: '',
    mobile: '',
    email: '',
    branches: [''],
    departments: [''],
    pan: '',
    website: '',
    cin: '',
    tan: '',
    msme: '',
    businessCategory: '',
  };
}

/** Edit-mode pre-fill from the company profile and the department names of the company. */
export function formFromDetails(d: CompanyDetails, departmentNames: readonly string[]): CompanyFormValues {
  return {
    name: d.name,
    address: d.address,
    state: d.state ?? '',
    district: d.district ?? '',
    pincode: d.pincode ? String(d.pincode) : '',
    gstNumber: d.gstNumber ?? '',
    mobile: d.mobile ?? '',
    email: (d.email ?? '').toLowerCase(),
    branches: [''],
    departments: departmentNames.length > 0 ? [...departmentNames] : [''],
    pan: d.pan ?? '',
    website: d.website ?? '',
    cin: d.cin ?? '',
    tan: d.tan ?? '',
    msme: d.msme ?? '',
    businessCategory: d.businessCategory ?? '',
  };
}

/** True when any of the collapsible "more details" fields has a value (the panel starts expanded then). */
export function hasMoreDetails(v: CompanyFormValues): boolean {
  return [v.pan, v.website, v.cin, v.tan, v.msme, v.businessCategory].some((x) => x.trim() !== '');
}

// ─── repeatable lists (branches / departments) ──────────────────────────────────────────────

export const listAdd = (list: readonly string[]): string[] => [...list, ''];
export const listUpdate = (list: readonly string[], index: number, value: string): string[] => list.map((x, i) => (i === index ? value : x));
/** Removes one row, never the last one. */
export const listRemove = (list: readonly string[], index: number): string[] => (list.length <= 1 ? [...list] : list.filter((_, i) => i !== index));
export const nonBlank = (list: readonly string[]): string[] => list.map((x) => x.trim()).filter((x) => x !== '');

// ─── validation ─────────────────────────────────────────────────────────────────────────────

export const MSG_REQUIRED = 'Please fill all required fields including State, District and Pincode';
export const MSG_PINCODE = 'Enter a valid 6-digit pincode';
export const MSG_VERIFY_MOBILE = 'Please verify new mobile number';
export const MSG_VERIFY_EMAIL = 'Please verify new email address';
export const MSG_NO_SESSION = 'User session not found';

export type CompanyValidation = { message: string | null; fieldErrors: { pincode?: string } };

/**
 * Required fields: name, address, state, district, pincode (all trimmed - v1 accepted blanks) and, when ADDING, at least
 * one branch. In edit mode the branch list is hidden, so a company without branches can still be edited (v1 required
 * a non-blank branch even then). Pincode must be 6 digits.
 */
export function validateCompanyForm(v: CompanyFormValues, mode: CompanyMode): CompanyValidation {
  const missing =
    v.name.trim() === '' ||
    v.address.trim() === '' ||
    v.state.trim() === '' ||
    v.district.trim() === '' ||
    v.pincode.trim() === '' ||
    (mode === 'add' && nonBlank(v.branches).length === 0);
  if (missing) return { message: MSG_REQUIRED, fieldErrors: {} };
  if (!/^\d{6}$/.test(v.pincode.trim())) return { message: MSG_PINCODE, fieldErrors: { pincode: MSG_PINCODE } };
  return { message: null, fieldErrors: {} };
}

// ─── OTP verification rules ─────────────────────────────────────────────────────────────────

/** "Get OTP" shows for a full 10-digit mobile that differs from the saved one (add mode: saved = ''). */
export const canRequestMobileOtp = (mobile: string, original: string): boolean => mobile.length === MAX_LENGTH.mobile && mobile !== original;
export const canRequestEmailOtp = (email: string, original: string): boolean => email.includes('@') && email !== original;

/** Edit mode only: a changed, non-empty contact must be OTP-verified before saving. */
export function contactNeedsVerification(mode: CompanyMode, value: string, original: string, verified: boolean): boolean {
  return mode === 'edit' && value !== original && value !== '' && !verified;
}

export const digitsOnly = (v: string): string => v.replace(/\D/g, '');

// ─── payload ────────────────────────────────────────────────────────────────────────────────

export type BuildContext = {
  userId: string;
  mode: CompanyMode;
  /** Legacy `org_gst` of the company being edited; sent back unchanged (v1 always blanked it). */
  legacyGst?: string;
};

/**
 * `CompanyInput` for `POST /company/add` / `PUT /company/update/{org}`.
 *  - edit mode never sends branches (`[]`);
 *  - departments: the non-blank names; none -> `[]` when editing, `['General']` when adding;
 *  - values are trimmed, statutory IDs upper-cased, email lower-cased, pincode numeric.
 */
export function buildCompanyInput(v: CompanyFormValues, ctx: BuildContext): CompanyInput {
  const departments = nonBlank(v.departments);
  return {
    userId: ctx.userId,
    name: v.name.trim(),
    address: v.address.trim(),
    gst: ctx.mode === 'edit' ? (ctx.legacyGst ?? '') : '',
    gstNumber: v.gstNumber.trim().toUpperCase(),
    branches: ctx.mode === 'edit' ? [] : nonBlank(v.branches),
    departments: departments.length > 0 ? departments : ctx.mode === 'edit' ? [] : ['General'],
    mobile: v.mobile.trim(),
    email: v.email.trim().toLowerCase(),
    pan: v.pan.trim().toUpperCase(),
    website: v.website.trim(),
    cin: v.cin.trim().toUpperCase(),
    tan: v.tan.trim().toUpperCase(),
    msme: v.msme.trim(),
    businessCategory: v.businessCategory.trim(),
    state: v.state.trim(),
    district: v.district.trim(),
    pincode: Number(v.pincode.trim()),
  };
}

// ─── delete ─────────────────────────────────────────────────────────────────────────────────

/** Delete is only offered when the admin owns more than one company (an admin must keep at least one). */
export const canDeleteCompany = (companyCount: number): boolean => companyCount > 1;

/**
 * Which company becomes active after deleting `deletedOrgId`. The server returns the remaining companies oldest first.
 * Switch only when the deleted company WAS the active one (or the active one is gone); otherwise keep the current one.
 * (v1 always switched to the first remaining company, even when another company was active.) `null` = no switch.
 */
export function nextActiveCompany(remaining: readonly Company[], deletedOrgId: string, activeOrgId: string): Company | null {
  if (remaining.length === 0) return null;
  if (activeOrgId !== deletedOrgId && remaining.some((c) => c.orgId === activeOrgId)) return null;
  return remaining[0];
}
