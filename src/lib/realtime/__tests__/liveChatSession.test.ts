import { liveChatSession } from '../liveChatSession';

jest.mock('@/store/auth', () => {
  const teardowns: (() => void)[] = [];
  return {
    teardowns,
    registerTeardown: (fn: () => void) => {
      teardowns.push(fn);
      return () => undefined;
    },
  };
});

const mockTeardowns = (jest.requireMock('@/store/auth') as { teardowns: (() => void)[] }).teardowns;

describe('liveChatSession', () => {
  afterEach(() => liveChatSession.setOpen(false));

  it('is closed by default and follows setOpen', () => {
    expect(liveChatSession.isOpen()).toBe(false);
    liveChatSession.setOpen(true);
    expect(liveChatSession.isOpen()).toBe(true);
    liveChatSession.setOpen(false);
    expect(liveChatSession.isOpen()).toBe(false);
  });

  it('is reset by the sign-out teardown', () => {
    expect(mockTeardowns).toHaveLength(1);
    liveChatSession.setOpen(true);
    mockTeardowns[0]();
    expect(liveChatSession.isOpen()).toBe(false);
  });
});
