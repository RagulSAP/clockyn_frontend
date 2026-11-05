/** Mappers for the organisation structure: branches, departments, companies. */
import type { Branch, BranchInput, BranchStaffMember } from '@/types/api/branches';
import type { Company, CompanyDetails, CompanyInput } from '@/types/api/company';
import type { Department } from '@/types/api/departments';
import { num, optNum, optStr, rec, str } from './common';

/** Default punch radius (metres) used by the server when a branch has none. */
export const DEFAULT_PUNCH_RADIUS = 100;

export function mapBranch(input: unknown): Branch {
  const r = rec(input);
  return {
    id: str(r.branch_id),
    name: str(r.branch_name),
    address: str(r.branch_address),
    orgId: str(r.org_id),
    latitude: num(r.branch_latitude, 0),
    longitude: num(r.branch_longitude, 0),
    radius: num(r.punch_radius, DEFAULT_PUNCH_RADIUS) || DEFAULT_PUNCH_RADIUS,
    raw: r,
  };
}

/** Body of `POST /branch/add` and `PUT /branch/update/{id}`. */
export function toBranchBody(input: BranchInput): Record<string, unknown> {
  return {
    branch_name: input.name.trim(),
    branch_address: input.address.trim(),
    branch_latitude: input.latitude,
    branch_longitude: input.longitude,
    punch_radius: input.radius,
    org_id: input.orgId,
  };
}

export function mapBranchStaff(input: unknown): BranchStaffMember {
  const r = rec(input);
  return {
    userId: str(r.user_id),
    name: str(r.name),
    empId: str(r.emp_id),
    mobile: str(r.mobile_number),
    email: str(r.email),
    department: str(r.dept_name),
    branchId: str(r.current_branch_id),
    branchName: str(r.current_branch_name),
  };
}

export function mapDepartment(input: unknown): Department {
  const r = rec(input);
  return { id: str(r.dept_id), name: str(r.dept_name), orgId: str(r.org_id), raw: r };
}

export function mapCompany(input: unknown): Company {
  const r = rec(input);
  return {
    orgId: str(r.org_id),
    name: str(r.org_name),
    address: str(r.org_address),
    gst: str(r.org_gst),
    createdAt: optStr(r.created_at),
    raw: r,
  };
}

export function mapCompanyDetails(input: unknown): CompanyDetails {
  const r = rec(input);
  return {
    ...mapCompany(r),
    ownerId: optStr(r.parent_id),
    state: optStr(r.state),
    district: optStr(r.district),
    pincode: optNum(r.pincode),
    mobile: optStr(r.mobile_number),
    email: optStr(r.email),
    // `logo_url` is the resolved URL; `org_logo` is the stored key/URL.
    logoUrl: optStr(r.logo_url) ?? optStr(r.org_logo),
    pan: optStr(r.pan_number),
    website: optStr(r.company_website),
    cin: optStr(r.cin_number),
    tan: optStr(r.tan_number),
    msme: optStr(r.msme_number),
    businessCategory: optStr(r.business_category),
    gstNumber: optStr(r.gst_number),
    maxSessionsPerDay: optNum(r.max_sessions_per_day),
  };
}

/** Body of `POST /company/add` and `PUT /company/update/{org}` (legacy field names). */
export function toCompanyBody(input: CompanyInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    user_id: input.userId,
    org_name: input.name.trim(),
    org_address: input.address.trim(),
    org_gst: input.gst ?? '',
    departments: input.departments,
    branches: input.branches,
  };
  const optional: Record<string, string | number | undefined> = {
    gst_number: input.gstNumber,
    mobile_number: input.mobile,
    email: input.email,
    pan_number: input.pan,
    company_website: input.website,
    cin_number: input.cin,
    tan_number: input.tan,
    msme_number: input.msme,
    business_category: input.businessCategory,
    state: input.state,
    district: input.district,
    pincode: input.pincode,
    max_sessions_per_day: input.maxSessionsPerDay,
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v !== undefined && v !== '') body[k] = v;
  }
  return body;
}
