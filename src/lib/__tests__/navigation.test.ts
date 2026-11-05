import { renderHook } from '@testing-library/react-native';

import { routes } from '@/config/routes';

import { buildHref, cleanParams, goHome, goToWelcome, navigate, useAppRouter } from '../navigation';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  dismissAll: jest.fn(),
  navigate: jest.fn(),
};

jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockRouter.push(...a),
    replace: (...a: unknown[]) => mockRouter.replace(...a),
    back: () => mockRouter.back(),
    canGoBack: () => mockRouter.canGoBack(),
    dismissAll: () => mockRouter.dismissAll(),
  },
  useRouter: () => mockRouter,
}));

beforeEach(() => {
  Object.values(mockRouter).forEach((f) => f.mockClear());
  mockRouter.canGoBack.mockReturnValue(true);
  mockRouter.dismissAll.mockImplementation(() => undefined);
});

describe('cleanParams / buildHref', () => {
  it('drops undefined / null / empty params and stringifies the rest', () => {
    expect(cleanParams({ a: 1, b: undefined, c: null, d: '', e: false, f: 'x' })).toEqual({ a: '1', e: 'false', f: 'x' });
    expect(cleanParams({ a: undefined })).toBeUndefined();
    expect(cleanParams(undefined)).toBeUndefined();
  });
  it('returns the plain path when there are no params', () => {
    expect(buildHref(routes.admin.home)).toBe('/admin/home');
    expect(buildHref(routes.admin.home, { x: undefined })).toBe('/admin/home');
  });
  it('returns a pathname + params object otherwise', () => {
    expect(buildHref(routes.admin.staff.detail, { staffId: 'abc', skip: undefined })).toEqual({
      pathname: '/admin/staff/detail',
      params: { staffId: 'abc' },
    });
  });
});

describe('useAppRouter', () => {
  it('push / replace go through typed hrefs', async () => {
    const { result } = await renderHook(() => useAppRouter());
    result.current.push(routes.admin.staff.detail, { staffId: '7' });
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/admin/staff/detail', params: { staffId: '7' } });
    result.current.replace(routes.adminLogin);
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin-login');
  });
  it('back / canGoBack / backOr', async () => {
    const { result } = await renderHook(() => useAppRouter());
    result.current.back();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    result.current.backOr(routes.staff.home);
    expect(mockRouter.back).toHaveBeenCalledTimes(2);
    mockRouter.canGoBack.mockReturnValue(false);
    result.current.backOr(routes.staff.home);
    expect(mockRouter.replace).toHaveBeenCalledWith('/staff/home');
    result.current.backOr();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
    expect(result.current.canGoBack()).toBe(false);
  });
  it('dismissAll never throws', async () => {
    mockRouter.dismissAll.mockImplementation(() => {
      throw new Error('GO_BACK was not handled');
    });
    const { result } = await renderHook(() => useAppRouter());
    expect(() => result.current.dismissAll()).not.toThrow();
  });
  it('goHome routes by role', async () => {
    const { result } = await renderHook(() => useAppRouter());
    result.current.goHome(1);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/admin/home');
    result.current.goHome(2);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/staff/home');
    result.current.goHome(3);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/staff/home');
  });
  it('keeps a stable identity across renders', async () => {
    const { result, rerender } = await renderHook(() => useAppRouter());
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
  });
});

describe('imperative helpers', () => {
  it('goHome / goToWelcome / navigate', () => {
    goHome(1);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/admin/home');
    goHome(null);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/staff/home');
    goToWelcome();
    expect(mockRouter.dismissAll).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
    navigate.push(routes.staff.requests.leave, { date: '2025-01-01' });
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/staff/requests/leave', params: { date: '2025-01-01' } });
    navigate.replace(routes.welcome);
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });
  it('goToWelcome survives a failing dismissAll', () => {
    mockRouter.dismissAll.mockImplementation(() => {
      throw new Error('nothing to dismiss');
    });
    expect(() => goToWelcome()).not.toThrow();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });
});
