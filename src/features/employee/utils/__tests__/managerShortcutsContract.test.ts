import fs from 'fs';
import path from 'path';

import { MANAGER_PERMISSIONS } from '@/features/team-rules/utils/permissions';

import { ADMIN_SHORTCUTS, availableAdminShortcuts } from '../managerShortcuts';

const APP_DIR = path.resolve(__dirname, '../../../../app');

/** True when `src/app<route>.tsx` or `src/app<route>/index.tsx` exists. */
function routeFileExists(route: string): boolean {
  const base = path.join(APP_DIR, route);
  return fs.existsSync(`${base}.tsx`) || fs.existsSync(path.join(base, 'index.tsx'));
}

describe('manager shortcut contract with the admin manager-permission catalogue', () => {
  it('uses exactly the catalogue strings (char for char) in the catalogue order', () => {
    expect(ADMIN_SHORTCUTS.map((s) => s.permission)).toEqual([...MANAGER_PERMISSIONS]);
    for (const s of ADMIN_SHORTCUTS) expect(s.title).toBe(s.permission);
  });

  it('a manager granted the whole catalogue sees every shortcut; an unknown name shows nothing', () => {
    expect(availableAdminShortcuts(2, [...MANAGER_PERMISSIONS])).toHaveLength(MANAGER_PERMISSIONS.length);
    expect(availableAdminShortcuts(2, ['Payroll Management', ' Staff Management'])).toEqual([]);
  });

  it('every target route has a route file', () => {
    const targets = ADMIN_SHORTCUTS.flatMap((s) => [...(s.route ? [s.route] : []), ...(s.options ?? []).map((o) => o.route)]);
    expect(targets.length).toBeGreaterThan(10);
    for (const route of targets) expect({ route, exists: routeFileExists(route) }).toEqual({ route, exists: true });
  });
});
