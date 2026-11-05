/** Employee details report: field sections, the printable HTML (fully escaped) and search / error helpers. */
import { escapeHtml } from '@/lib/platform/exportFormats';
import { formatDate } from '@/lib/datetime';
import type { StaffMember, StaffProfile } from '@/types/api/staff';

export interface ProfileField {
  label: string;
  value: string;
}

export interface ProfileSection {
  title: string;
  fields: ProfileField[];
}

/** A field is shown only when it has a value other than `-`. */
export function hasValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== '-';
}

function dateText(value: string | undefined): string | undefined {
  if (!hasValue(value)) return undefined;
  const formatted = formatDate(value);
  return formatted === '--' ? value : formatted;
}

/** The four profile sections; fields without a value are dropped, and a section without fields is dropped entirely. */
export function profileSections(p: StaffProfile): ProfileSection[] {
  const section = (title: string, entries: [string, string | undefined][]): ProfileSection => ({
    title,
    fields: entries.filter((e): e is [string, string] => hasValue(e[1])).map(([label, value]) => ({ label, value })),
  });
  return [
    section('Contact Information', [
      ['Mobile', p.mobile],
      ['Email', p.email],
      ['Address', p.address],
      ['Emergency Contact', p.emergencyContact],
    ]),
    section('Personal Information', [
      ['Date of Birth', dateText(p.dob)],
      ['Gender', p.gender],
      ['Blood Group', p.bloodGroup],
      ["Father's Name", p.fatherName],
      ['Marital Status', p.maritalStatus],
      ['Date of Joining', dateText(p.doj)],
    ]),
    section('Identity Documents', [
      ['Aadhaar No', p.aadhaarNo],
      ['PAN No', p.panNo],
      ['UAN No', p.uanNo],
      ['PF No', p.pfNo],
      ['ESI No', p.esiNo],
    ]),
    section('Bank Details', [
      ['Account No', p.bankAccountNo],
      ['IFSC Code', p.ifsc],
      ['Bank Name', p.bankName],
      ['Bank Branch', p.bankBranch],
    ]),
  ].filter((s) => s.fields.length > 0);
}

/** Chips under the name: department, branch, role (only the present ones). */
export function profileChips(p: StaffProfile): string[] {
  return [p.department, p.branch, p.roleName].filter(hasValue);
}

/**
 * Self-contained, print-ready HTML of one profile. EVERY dynamic value is HTML-escaped (v1 inserted raw values).
 * Passed to `exportHtml` for the real PDF / DOC file.
 */
export function buildProfileHtml(p: StaffProfile, companyName?: string): string {
  const sections = profileSections(p);
  const chips = profileChips(p)
    .map((c) => `<span class="chip">${escapeHtml(c)}</span>`)
    .join('');
  const rows = (s: ProfileSection) =>
    s.fields.map((f) => `<tr><td class="k">${escapeHtml(f.label)}</td><td>${escapeHtml(f.value)}</td></tr>`).join('');
  const body = sections
    .map((s) => `<div class="card"><h3>${escapeHtml(s.title)}</h3><table class="kv">${rows(s)}</table></div>`)
    .join('');
  const initial = escapeHtml((p.name.trim().charAt(0) || '?').toUpperCase());
  const title = `${p.name} - Employee Report`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;background:#ffffff;color:#111827;margin:0;padding:20px;max-width:640px}
.company{color:#6b7280;font-size:12px;margin:0 0 12px}
.head{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.avatar{width:56px;height:56px;border-radius:28px;background:#0D0D0D;color:#ffffff;font-size:24px;font-weight:700;text-align:center;line-height:56px}
.name{font-size:20px;font-weight:700;margin:0}.emp{color:#6b7280;margin:2px 0 6px}
.chip{display:inline-block;background:#eeeeec;border-radius:10px;padding:2px 10px;margin-right:6px;font-size:12px}
.card{border:1px solid #d1d5db;border-radius:8px;padding:12px 14px;margin-bottom:12px;page-break-inside:avoid}
h3{margin:0 0 8px;font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:#0D0D0D}
table.kv{width:100%;border-collapse:collapse}table.kv td{padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
td.k{color:#6b7280;width:40%}
</style></head><body>
${companyName ? `<p class="company">${escapeHtml(companyName)}</p>` : ''}
<div class="head"><div class="avatar">${initial}</div><div><p class="name">${escapeHtml(p.name)}</p><p class="emp">${escapeHtml(p.empId)}</p>${chips}</div></div>
${body}
</body></html>`;
}

/** Case-insensitive substring search over name, employee id, department and branch; A→Z by name. */
export function filterDirectory(staff: readonly StaffMember[], query: string): StaffMember[] {
  const q = query.trim().toLowerCase();
  const hit = (s: StaffMember) =>
    q === '' || [s.name, s.empId, s.department, s.branch].some((v) => (v ?? '').toLowerCase().includes(q));
  return staff.filter(hit).sort((a, b) => a.name.localeCompare(b.name));
}

/** Message shown when a profile cannot be opened. Inactive staff have no profile on the server. */
export function profileErrorMessage(staff: Pick<StaffMember, 'name' | 'isActive'>, serverMessage?: string): string {
  if (!staff.isActive) return `${staff.name} is inactive. Profile details are only available for active staff.`;
  return serverMessage && serverMessage.trim() !== '' ? serverMessage : 'Failed to load employee details';
}
