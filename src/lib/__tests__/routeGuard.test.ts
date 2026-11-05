import { ADMIN_AREA_ROLES, normalizeRole, resolveAreaGuard, resolveRootRedirect, STAFF_AREA_ROLES } from '../routeGuard';

describe('normalizeRole', () => {
  it('accepts 1..3 (number or numeric string) and rejects everything else', () => {
    expect(normalizeRole(1)).toBe(1);
    expect(normalizeRole('3')).toBe(3);
    expect(normalizeRole(0)).toBeNull();
    expect(normalizeRole(4)).toBeNull();
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole('x')).toBeNull();
  });
});

describe('resolveRootRedirect', () => {
  it('waits for hydration and never redirects before it', () => {
    expect(resolveRootRedirect({ hydrated: false, role: 1 })).toEqual({ ready: false, href: null });
  });
  it('stays on the welcome screen when signed out', () => {
    expect(resolveRootRedirect({ hydrated: true, role: null })).toEqual({ ready: true, href: null });
    expect(resolveRootRedirect({ hydrated: true, role: 9 })).toEqual({ ready: true, href: null });
  });
  it('sends each role to its home', () => {
    expect(resolveRootRedirect({ hydrated: true, role: 1 }).href).toBe('/admin/home');
    expect(resolveRootRedirect({ hydrated: true, role: 2 }).href).toBe('/staff/home');
    expect(resolveRootRedirect({ hydrated: true, role: 3 }).href).toBe('/staff/home');
  });
});

describe('resolveAreaGuard', () => {
  it('is loading until hydrated', () => {
    expect(resolveAreaGuard({ hydrated: false, role: 1, allowed: ADMIN_AREA_ROLES })).toEqual({ status: 'loading' });
  });
  it('redirects signed-out visitors (deep links) to welcome', () => {
    expect(resolveAreaGuard({ hydrated: true, role: null, allowed: ADMIN_AREA_ROLES })).toEqual({ status: 'redirect', href: '/' });
    expect(resolveAreaGuard({ hydrated: true, role: null, allowed: STAFF_AREA_ROLES })).toEqual({ status: 'redirect', href: '/' });
  });
  it('admin area: roles 1 and 2 allowed, role 3 sent home', () => {
    expect(resolveAreaGuard({ hydrated: true, role: 1, allowed: ADMIN_AREA_ROLES })).toEqual({ status: 'allow' });
    expect(resolveAreaGuard({ hydrated: true, role: 2, allowed: ADMIN_AREA_ROLES })).toEqual({ status: 'allow' });
    expect(resolveAreaGuard({ hydrated: true, role: 3, allowed: ADMIN_AREA_ROLES })).toEqual({ status: 'redirect', href: '/staff/home' });
  });
  it('staff area: roles 2 and 3 allowed, admin sent to the admin home', () => {
    expect(resolveAreaGuard({ hydrated: true, role: 2, allowed: STAFF_AREA_ROLES })).toEqual({ status: 'allow' });
    expect(resolveAreaGuard({ hydrated: true, role: 3, allowed: STAFF_AREA_ROLES })).toEqual({ status: 'allow' });
    expect(resolveAreaGuard({ hydrated: true, role: 1, allowed: STAFF_AREA_ROLES })).toEqual({ status: 'redirect', href: '/admin/home' });
  });
});
