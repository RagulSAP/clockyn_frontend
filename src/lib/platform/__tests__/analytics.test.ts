import { logEvent, setAnalyticsProvider } from '../analytics';

describe('analytics', () => {
  afterEach(() => setAnalyticsProvider(null));

  it('is a safe no-op by default', () => {
    expect(() => logEvent('AppOpened')).not.toThrow();
  });

  it('forwards typed events to the provider', () => {
    const spy = jest.fn();
    setAnalyticsProvider({ logEvent: spy });
    logEvent('LoginSuccess');
    logEvent('AttendanceMarked', { action: 'checkin' });
    expect(spy).toHaveBeenNthCalledWith(1, 'LoginSuccess', undefined);
    expect(spy).toHaveBeenNthCalledWith(2, 'AttendanceMarked', { action: 'checkin' });
  });

  it('never lets a faulty provider break the app', () => {
    setAnalyticsProvider({
      logEvent: () => {
        throw new Error('boom');
      },
    });
    expect(() => logEvent('Subscribe')).not.toThrow();
  });
});
