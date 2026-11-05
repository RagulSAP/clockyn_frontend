/** Personal-details form model: fields, sanitising, validation and mapping (pure, unit-tested). */
import type { IconName } from '@/components/ui';
import type { EmployeePersonalDetails, UpdatePersonalDetailsInput } from '@/types/api/employee';

export type FieldKey =
  | 'name'
  | 'fatherName'
  | 'mobile'
  | 'email'
  | 'address'
  | 'gender'
  | 'dob'
  | 'bloodGroup'
  | 'maritalStatus'
  | 'emergencyContact'
  | 'aadhaar'
  | 'pan'
  | 'uan'
  | 'pf'
  | 'esi'
  | 'doj'
  | 'bankName'
  | 'bankBranch'
  | 'accountNumber'
  | 'ifsc';

/** Edit buffer: every field is a string (`''` = empty); dates are `YYYY-MM-DD`. */
export type PersonalDraft = Record<FieldKey, string>;

export interface FieldRule {
  maxLen: number;
  hint: string;
  regex: RegExp;
}

/** Optional fields: an empty value is always valid. */
export const FIELD_RULES: Partial<Record<FieldKey, FieldRule>> = {
  aadhaar: { maxLen: 12, hint: '12-digit number', regex: /^\d{12}$/ },
  pan: { maxLen: 10, hint: 'e.g. ABCDE1234F', regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
  uan: { maxLen: 12, hint: '12-digit number', regex: /^\d{12}$/ },
  pf: { maxLen: 25, hint: 'Alphanumeric with / allowed', regex: /^[a-zA-Z0-9/]{1,25}$/ },
  esi: { maxLen: 17, hint: '17-digit number', regex: /^\d{17}$/ },
  mobile: { maxLen: 10, hint: '10-digit number starting 6-9', regex: /^[6-9]\d{9}$/ },
  emergencyContact: { maxLen: 10, hint: '10-digit number starting 6-9', regex: /^[6-9]\d{9}$/ },
};

/** Validation order (the first invalid field is reported first). */
export const VALIDATION_ORDER: FieldKey[] = ['aadhaar', 'pan', 'uan', 'pf', 'esi', 'mobile', 'emergencyContact'];

const DIGIT_ONLY: FieldKey[] = ['aadhaar', 'uan', 'esi', 'mobile', 'emergencyContact'];
const UPPERCASE: FieldKey[] = ['pan', 'ifsc'];

export type FieldInputType = 'text' | 'number' | 'email' | 'multiline' | 'select' | 'date';

export interface FieldDef {
  key: FieldKey;
  label: string;
  type: FieldInputType;
  options?: readonly string[];
}

export interface SectionDef {
  key: 'personal' | 'identity' | 'bank';
  title: string;
  icon: IconName;
  fields: FieldDef[];
}

export const GENDERS = ['Male', 'Female', 'Other'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'] as const;

export const SECTIONS: SectionDef[] = [
  {
    key: 'personal',
    title: 'Personal Info',
    icon: 'user',
    fields: [
      { key: 'fatherName', label: 'Father Name', type: 'text' },
      { key: 'mobile', label: 'Mobile', type: 'number' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'address', label: 'Address', type: 'multiline' },
      { key: 'gender', label: 'Gender', type: 'select', options: GENDERS },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'bloodGroup', label: 'Blood Group', type: 'select', options: BLOOD_GROUPS },
      { key: 'maritalStatus', label: 'Marital Status', type: 'select', options: MARITAL_STATUSES },
      { key: 'emergencyContact', label: 'Emergency Contact', type: 'number' },
    ],
  },
  {
    key: 'identity',
    title: 'Identity & Compliance',
    icon: 'shield-check',
    fields: [
      { key: 'aadhaar', label: 'Aadhaar No', type: 'number' },
      { key: 'pan', label: 'PAN No', type: 'text' },
      { key: 'uan', label: 'UAN No', type: 'number' },
      { key: 'pf', label: 'PF No', type: 'text' },
      { key: 'esi', label: 'ESI No', type: 'number' },
      { key: 'doj', label: 'Date of Joining', type: 'date' },
    ],
  },
  {
    key: 'bank',
    title: 'Bank Details',
    icon: 'banknote',
    fields: [
      { key: 'bankName', label: 'Bank Name', type: 'text' },
      { key: 'bankBranch', label: 'Bank Branch', type: 'text' },
      { key: 'accountNumber', label: 'Account Number', type: 'number' },
      { key: 'ifsc', label: 'IFSC Code', type: 'text' },
    ],
  },
];

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Name',
  ...Object.fromEntries(SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.label]))),
} as Record<FieldKey, string>;

export const EMPTY_DRAFT: PersonalDraft = {
  name: '',
  fatherName: '',
  mobile: '',
  email: '',
  address: '',
  gender: '',
  dob: '',
  bloodGroup: '',
  maritalStatus: '',
  emergencyContact: '',
  aadhaar: '',
  pan: '',
  uan: '',
  pf: '',
  esi: '',
  doj: '',
  bankName: '',
  bankBranch: '',
  accountNumber: '',
  ifsc: '',
};

/** API details -> edit buffer. */
export function toDraft(d: EmployeePersonalDetails | undefined | null): PersonalDraft {
  if (!d) return { ...EMPTY_DRAFT };
  return {
    name: d.name,
    fatherName: d.fatherName ?? '',
    mobile: d.mobile,
    email: d.email,
    address: d.address ?? '',
    gender: d.gender ?? '',
    dob: d.dob ?? '',
    bloodGroup: d.bloodGroup ?? '',
    maritalStatus: d.maritalStatus ?? '',
    emergencyContact: d.emergencyContact ?? '',
    aadhaar: d.aadhaarNo ?? '',
    pan: d.panNo ?? '',
    uan: d.uanNo ?? '',
    pf: d.pfNo ?? '',
    esi: d.esiNo ?? '',
    doj: d.doj ?? '',
    bankName: d.bankName ?? '',
    bankBranch: d.bankBranch ?? '',
    accountNumber: d.accountNumber ?? '',
    ifsc: d.ifscCode ?? '',
  };
}

/** Typing sanitiser: upper-case PAN / IFSC, digits only for numeric ids, then cap the length. */
export function sanitizeInput(key: FieldKey, text: string): string {
  let v = text;
  if (UPPERCASE.includes(key)) v = v.toUpperCase();
  if (DIGIT_ONLY.includes(key)) v = v.replace(/\D/g, '');
  const rule = FIELD_RULES[key];
  if (rule && v.length > rule.maxLen) v = v.slice(0, rule.maxLen);
  return v;
}

/** Inline error of one field (`''` valid). Empty values are always valid. */
export function fieldError(key: FieldKey, value: string): string {
  const rule = FIELD_RULES[key];
  if (!rule || value === '') return '';
  return rule.regex.test(value) ? '' : rule.hint;
}

export interface FieldIssue {
  key: FieldKey;
  label: string;
  hint: string;
}

/**
 * Invalid fields in validation order. Only fields the user CHANGED are checked, so an old stored value that does
 * not match the pattern no longer blocks saving unrelated edits (v1 did).
 */
export function validateChanged(draft: PersonalDraft, original: PersonalDraft): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const key of VALIDATION_ORDER) {
    if (draft[key] === original[key]) continue;
    const hint = fieldError(key, draft[key]);
    if (hint) issues.push({ key, label: FIELD_LABELS[key], hint });
  }
  return issues;
}

/** Text of the "Invalid Input" message: one `Label: hint` line per issue. */
export function issuesMessage(issues: FieldIssue[]): string {
  return issues.map((i) => `${i.label}: ${i.hint}`).join('\n');
}

/** Whether the buffer differs from the saved values (or a new photo is pending). */
export function hasUnsavedChanges(draft: PersonalDraft, saved: PersonalDraft, hasNewPhoto: boolean): boolean {
  if (hasNewPhoto) return true;
  return (Object.keys(draft) as FieldKey[]).some((k) => draft[k] !== saved[k]);
}

/** Edit buffer -> update payload. */
export function toUpdateInput(draft: PersonalDraft): UpdatePersonalDetailsInput {
  return {
    name: draft.name,
    mobile: draft.mobile,
    email: draft.email,
    dob: draft.dob,
    gender: draft.gender,
    bloodGroup: draft.bloodGroup,
    address: draft.address,
    emergencyContact: draft.emergencyContact,
    accountNumber: draft.accountNumber,
    ifscCode: draft.ifsc,
    bankName: draft.bankName,
    bankBranch: draft.bankBranch,
    fatherName: draft.fatherName,
    maritalStatus: draft.maritalStatus,
    aadhaarNo: draft.aadhaar,
    panNo: draft.pan,
    uanNo: draft.uan,
    pfNo: draft.pf,
    esiNo: draft.esi,
    doj: draft.doj,
  };
}

/** Select options: the fixed list plus the current stored value when it is not one of them (legacy free text). */
export function optionsWithCurrent(options: readonly string[], current: string): { label: string; value: string }[] {
  const list = current && !options.includes(current) ? [...options, current] : [...options];
  return list.map((o) => ({ label: o, value: o }));
}
