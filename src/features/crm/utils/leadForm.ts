/** Lead form values, validation and payload builders (admin Enter/Edit Lead and the staff Add Lead sheet). */
import { digitsOnly, isValidMobile } from '@/lib/format';
import type { Lead, LeadInput, UpdateLeadInput } from '@/types/api/leads';

export interface LeadFormValues {
  name: string;
  mobile: string;
  address: string;
  category: string;
  remarks: string;
  /** `YYYY-MM-DD` or '' (optional customer-required date). */
  requiredDate: string;
}

export const EMPTY_LEAD_FORM: LeadFormValues = { name: '', mobile: '', address: '', category: '', remarks: '', requiredDate: '' };

/** v1 differs in punctuation: the admin screen toasts, the staff sheet shows inline text ending in a period. */
export type LeadFormVariant = 'admin' | 'staff';

export const LEAD_MESSAGES = {
  admin: { required: 'Please fill all required fields', mobile: 'Mobile number must be exactly 10 digits' },
  staff: { required: 'Please fill all required fields.', mobile: 'Mobile number must be 10 digits.' },
} as const;

export type LeadFormField = 'name' | 'mobile' | 'address' | 'category';

export interface LeadFormValidation {
  ok: boolean;
  /** Summary message (toast / inline banner); '' when valid. */
  message: string;
  /** Per-field inline hints. */
  fields: Partial<Record<LeadFormField, string>>;
}

/** Digits only, at most 10 (v1 only capped the length; letters were accepted). */
export const sanitizeMobile = (text: string): string => digitsOnly(text).slice(0, 10);

/**
 * Validation order (v1): required fields (name, mobile, address, category), then the 10-digit mobile.
 * Values are trimmed first (v1 let whitespace through).
 */
export function validateLeadForm(values: LeadFormValues, variant: LeadFormVariant = 'admin'): LeadFormValidation {
  const msgs = LEAD_MESSAGES[variant];
  const fields: LeadFormValidation['fields'] = {};
  const required: LeadFormField[] = ['name', 'mobile', 'address', 'category'];
  for (const f of required) {
    if (values[f].trim() === '') fields[f] = 'Required';
  }
  if (Object.keys(fields).length > 0) return { ok: false, message: msgs.required, fields };
  if (!isValidMobile(values.mobile)) return { ok: false, message: msgs.mobile, fields: { mobile: msgs.mobile } };
  return { ok: true, message: '', fields: {} };
}

/** Payload of `createLead`. */
export function toCreateInput(values: LeadFormValues, orgId: string): LeadInput {
  return {
    orgId,
    name: values.name,
    mobile: values.mobile,
    address: values.address,
    category: values.category,
    remarks: values.remarks,
    requiredDate: values.requiredDate || null,
  };
}

/** Payload of `updateLead`: the required date is always passed explicitly (the v1 edit blanked it). */
export function toUpdateInput(values: LeadFormValues, orgId: string): UpdateLeadInput {
  return { ...toCreateInput(values, orgId), requiredDate: values.requiredDate || null };
}

/** Form values for editing an existing lead - keeps the required date. */
export function leadToFormValues(lead: Lead): LeadFormValues {
  return {
    name: lead.clientName,
    mobile: lead.mobile,
    address: lead.address,
    category: lead.categoryName,
    remarks: lead.remarks,
    requiredDate: lead.requiredDate ?? '',
  };
}
