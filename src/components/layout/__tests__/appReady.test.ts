import { isAppReady } from '../appReady';

const base = { fontsLoaded: false, fontError: false, hydrated: false, timedOut: false };

describe('isAppReady (splash gate)', () => {
  it('waits for fonts AND hydration', () => {
    expect(isAppReady(base)).toBe(false);
    expect(isAppReady({ ...base, fontsLoaded: true })).toBe(false);
    expect(isAppReady({ ...base, hydrated: true })).toBe(false);
    expect(isAppReady({ ...base, fontsLoaded: true, hydrated: true })).toBe(true);
  });
  it('a font error does not trap the app', () => {
    expect(isAppReady({ ...base, fontError: true, hydrated: true })).toBe(true);
  });
  it('the safety timeout lifts the gate', () => {
    expect(isAppReady({ ...base, timedOut: true })).toBe(true);
  });
});
