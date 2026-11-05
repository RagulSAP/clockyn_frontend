/** Company departments. */
import { api } from '@/lib/api/client';
import type { Department, DepartmentWriteResult } from '@/types/api/departments';
import { listOf, messageOf, rec, str } from './mappers/common';
import { mapDepartment } from './mappers/org';
import { assertSuccess } from '@/lib/api/envelope';
import { seg } from './sharedHelpers';

/** Active departments of an organisation (never manager-scoped). `GET /home/departments?org_id=`. */
export async function listDepartments(orgId: string): Promise<Department[]> {
  const body = await api.get<unknown>('/home/departments', { org_id: orgId });
  return listOf(body).map(mapDepartment);
}

function mapWrite(body: unknown, fallback: string): DepartmentWriteResult {
  const checked = assertSuccess(body, fallback);
  const r = rec(checked);
  return { deptId: str(r.dept_id), deptName: str(r.dept_name), message: messageOf(r, fallback) };
}

/** Creates a department. `POST /department/add`. */
export async function addDepartment(input: { name: string; orgId: string }): Promise<DepartmentWriteResult> {
  const body = await api.post<unknown>('/department/add', { dept_name: input.name.trim(), org_id: input.orgId });
  return mapWrite(body, 'Department added successfully');
}

/** Renames a department. `PUT /department/update/{deptId}`. */
export async function updateDepartment(deptId: string, input: { name: string; orgId: string }): Promise<DepartmentWriteResult> {
  const body = await api.put<unknown>(`/department/update/${seg(deptId)}`, { dept_name: input.name.trim(), org_id: input.orgId });
  return mapWrite(body, 'Department updated successfully');
}

/** Deletes a department (a POST on the server). `POST /department/delete/{deptId}?org_id=`. */
export async function deleteDepartment(deptId: string, orgId: string): Promise<DepartmentWriteResult> {
  const body = await api.post<unknown>(`/department/delete/${seg(deptId)}`, undefined, { query: { org_id: orgId } });
  return mapWrite(body, 'Department deleted successfully');
}
