/**
 * Manager permission catalogue.
 *
 * The permission NAMES are an exact-string contract: the backend delivers them to the manager's session at login
 * (`managerPermissions`) and the staff Settings screen shows a shortcut only when the session contains the exact name.
 * Never rename, re-case or translate them.
 */
import type { IconName } from '@/components/ui';
import type { ManagerPermissions } from '@/types/api/managers';

export const MANAGER_PERMISSIONS = [
  'Staff Management',
  'Branch Management',
  'Attendance Reports',
  'Salary Management',
  'Holiday Management',
  'Shift Management',
  'Leads Management',
  'Incentive Management',
  'Company Settings',
  'Requests Management',
] as const;

export type ManagerPermissionName = (typeof MANAGER_PERMISSIONS)[number];

const PERMISSION_ICONS: Record<ManagerPermissionName, IconName> = {
  'Staff Management': 'users',
  'Branch Management': 'building',
  'Attendance Reports': 'bar-chart',
  'Salary Management': 'wallet',
  'Holiday Management': 'calendar-days',
  'Shift Management': 'clock',
  'Leads Management': 'target',
  'Incentive Management': 'award',
  'Company Settings': 'settings',
  'Requests Management': 'clipboard-list',
};

/** Icon for a permission; unknown names fall back to a neutral circle. */
export function permissionIcon(name: string): IconName {
  return (PERMISSION_ICONS as Record<string, IconName | undefined>)[name] ?? 'circle';
}

/**
 * Merges the server's permission map into the client catalogue (v1 replaced the catalogue with whatever the server
 * returned, which could be an empty object -> "0/0 permissions"). Catalogue names always appear first, in catalogue
 * order, defaulting to `false`; any extra names the server knows about are appended after them.
 */
export function mergePermissions(server: ManagerPermissions | null | undefined): ManagerPermissions {
  const out: ManagerPermissions = {};
  for (const name of MANAGER_PERMISSIONS) out[name] = server?.[name] === true;
  if (server) {
    for (const [name, value] of Object.entries(server)) {
      if (!(name in out)) out[name] = value === true;
    }
  }
  return out;
}

export function permissionNames(perms: ManagerPermissions): string[] {
  return Object.keys(perms);
}

export function countEnabled(perms: ManagerPermissions): number {
  return Object.values(perms).filter(Boolean).length;
}

/** True when there is at least one permission and all of them are on (an empty map is never "all on"). */
export function allEnabled(perms: ManagerPermissions): boolean {
  const values = Object.values(perms);
  return values.length > 0 && values.every(Boolean);
}

/** "Select All" toggles everything on, unless everything is already on - then it turns everything off. */
export function toggleAll(perms: ManagerPermissions): ManagerPermissions {
  const next = !allEnabled(perms);
  const out: ManagerPermissions = {};
  for (const name of Object.keys(perms)) out[name] = next;
  return out;
}

export function togglePermission(perms: ManagerPermissions, name: string): ManagerPermissions {
  return { ...perms, [name]: !perms[name] };
}

/** Progress (0-100) of enabled permissions; 0 for an empty map (never NaN). */
export function permissionProgress(perms: ManagerPermissions): number {
  const total = Object.keys(perms).length;
  return total === 0 ? 0 : Math.round((countEnabled(perms) / total) * 100);
}
