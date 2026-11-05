import { shouldRunUpdateCheck, UPDATE_CHECK_MIN_INTERVAL_MS, updatePromptCopy } from '../updateCopy';

describe('updatePromptCopy', () => {
  it('soft update: dismissible with Later and the default message', () => {
    expect(updatePromptCopy({ forceUpdate: false, message: '' })).toEqual({
      title: 'Update Available',
      message: 'A new version is available with the latest features & fixes.',
      dismissible: true,
      primaryLabel: 'Update Now',
      secondaryLabel: 'Later',
    });
  });
  it('forced update: not dismissible, no Later', () => {
    const c = updatePromptCopy({ forceUpdate: true, message: '' });
    expect(c.title).toBe('Update Required');
    expect(c.dismissible).toBe(false);
    expect(c.secondaryLabel).toBeNull();
    expect(c.message).toContain('Clockyn');
  });
  it('the server message wins', () => {
    expect(updatePromptCopy({ forceUpdate: false, message: 'Hello' }).message).toBe('Hello');
    expect(updatePromptCopy({ forceUpdate: true, message: 'Please update' }).message).toBe('Please update');
  });
});

describe('shouldRunUpdateCheck', () => {
  it('runs the first time and then at most every 10 minutes', () => {
    expect(shouldRunUpdateCheck(0, 1_000)).toBe(true);
    expect(shouldRunUpdateCheck(1_000, 1_000 + UPDATE_CHECK_MIN_INTERVAL_MS - 1)).toBe(false);
    expect(shouldRunUpdateCheck(1_000, 1_000 + UPDATE_CHECK_MIN_INTERVAL_MS)).toBe(true);
  });
});
