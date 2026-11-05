/** Companies (organisations) owned by an admin, company logo and account deletion. */
import { api } from '@/lib/api/client';
import { assertSuccess } from '@/lib/api/envelope';
import type { ActionResult, UploadFileInput } from '@/types/api/common';
import type { Company, CompanyDetails, CompanyInput, CompanyWriteResult, DeleteCompanyResult } from '@/types/api/company';
import { listOf, messageOf, objectOf, optStr, rec } from './mappers/common';
import { mapCompany, mapCompanyDetails, toCompanyBody } from './mappers/org';
import { toUploadFile } from './params';
import { seg } from './sharedHelpers';

function writeResult(body: unknown, fallback: string): CompanyWriteResult {
  const r = rec(assertSuccess(body, fallback));
  return {
    orgId: optStr(r.org_id),
    orgName: optStr(r.org_name),
    userId: optStr(r.user_id),
    message: messageOf(r, fallback),
  };
}

/** Adds another company to an existing admin account. `POST /company/add`. */
export async function addCompany(input: CompanyInput): Promise<CompanyWriteResult> {
  return writeResult(await api.post<unknown>('/company/add', toCompanyBody(input)), 'Company added successfully!');
}

/** Updates a company (edit mode sends `branches: []`). `PUT /company/update/{orgId}`. */
export async function updateCompany(orgId: string, input: CompanyInput): Promise<CompanyWriteResult> {
  return writeResult(await api.put<unknown>(`/company/update/${seg(orgId)}`, toCompanyBody(input)), 'Company updated successfully!');
}

/** Full company profile. `GET /company/details/{orgId}` (the path id is an org id). */
export async function getCompanyDetails(orgId: string, opts: { accessToken?: string } = {}): Promise<CompanyDetails> {
  const body = assertSuccess(await api.get<unknown>(`/company/details/${seg(orgId)}`, undefined, opts.accessToken ? { accessToken: opts.accessToken } : {}), 'Failed to load company');
  return mapCompanyDetails(objectOf(body, ['data']));
}

/** Companies owned by an admin (company switcher). `GET /company/list/{userId}`. */
export async function listCompanies(userId: string): Promise<Company[]> {
  const body = assertSuccess(await api.get<unknown>(`/company/list/${seg(userId)}`), 'Failed to load companies');
  return listOf(body).map(mapCompany);
}

/**
 * Deletes a company and ALL its staff, branches, departments and shifts (the last company cannot be
 * deleted). `DELETE /company/delete/{orgId}/{userId}`.
 */
export async function deleteCompany(orgId: string, userId: string): Promise<DeleteCompanyResult> {
  const body = assertSuccess(await api.delete<unknown>(`/company/delete/${seg(orgId)}/${seg(userId)}`), 'Failed to delete company');
  const r = rec(body);
  return {
    message: messageOf(r, 'Company deleted successfully'),
    remaining: listOf(r.remaining_companies).map(mapCompany),
  };
}

/** Replaces the logo of an existing company (PNG/JPEG); returns the new logo URL. `POST /company/update-logo/{orgId}` (field `logo`). */
export async function updateCompanyLogo(orgId: string, file: UploadFileInput): Promise<string | undefined> {
  const body = assertSuccess(
    await api.upload<unknown>(`/company/update-logo/${seg(orgId)}`, toUploadFile(file, 'logo', 'logo')),
    'Failed to update logo',
  );
  return optStr(rec(body).logo_url);
}

/** Permanently deletes the signed-in user's account (admin after OTP, or employee). `DELETE /company/delete-account/{userId}`. */
export async function deleteAccount(userId: string): Promise<ActionResult> {
  const body = assertSuccess(await api.delete<unknown>(`/company/delete-account/${seg(userId)}`), 'Failed to delete account');
  return { message: messageOf(body, 'Account deleted successfully') };
}

/** Asks for the account to be deleted (admin flow; the user is deactivated). `POST /company/request-deletion/{userId}`. */
export async function requestAccountDeletion(userId: string): Promise<ActionResult> {
  const body = assertSuccess(await api.post<unknown>(`/company/request-deletion/${seg(userId)}`), 'Failed to request account deletion');
  return { message: messageOf(body, 'Deletion request submitted') };
}
