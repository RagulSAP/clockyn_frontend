import type { RawRecord } from './common';

/** Company (organisation) owned by an admin; shown in the company switcher. */
export interface Company {
  orgId: string;
  name: string;
  address: string;
  gst: string;
  createdAt?: string;
  raw: RawRecord;
}

/** Full company profile (`/company/details/{org}`). */
export interface CompanyDetails extends Company {
  /** Owner (admin) user id. */
  ownerId?: string;
  state?: string;
  district?: string;
  pincode?: number;
  mobile?: string;
  email?: string;
  logoUrl?: string;
  pan?: string;
  website?: string;
  cin?: string;
  tan?: string;
  msme?: string;
  businessCategory?: string;
  gstNumber?: string;
}

/** Payload for adding / updating a company. */
export interface CompanyInput {
  /** Admin (owner) user id. */
  userId: string;
  name: string;
  address: string;
  /** Legacy duplicate GST field; screens may send `''` here and the number in `gstNumber`. */
  gst?: string;
  gstNumber?: string;
  /** Branch names to create (add mode needs at least one; edit mode sends `[]`). */
  branches: string[];
  /** Department names to create. */
  departments: string[];
  mobile?: string;
  email?: string;
  pan?: string;
  website?: string;
  cin?: string;
  tan?: string;
  msme?: string;
  businessCategory?: string;
  state?: string;
  district?: string;
  pincode?: number;
}

export interface CompanyWriteResult {
  orgId?: string;
  orgName?: string;
  userId?: string;
  message: string;
}

export interface DeleteCompanyResult {
  message: string;
  /** Companies the admin still owns after the deletion. */
  remaining: Company[];
}
