/** Pure logic of the department screens. */
import type { Department } from '@/types/api/departments';

export const DEPARTMENT_NAME_REQUIRED = 'Please enter department name';

/** `null` when valid. */
export function validateDepartmentName(name: string): string | null {
  return name.trim() === '' ? DEPARTMENT_NAME_REQUIRED : null;
}

export function sortDepartments(departments: readonly Department[]): Department[] {
  return [...departments].sort((a, b) => a.name.localeCompare(b.name));
}

export function departmentSavedMessage(name: string, isEdit: boolean): string {
  return isEdit ? `"${name}" has been updated successfully` : `"${name}" has been created successfully`;
}
