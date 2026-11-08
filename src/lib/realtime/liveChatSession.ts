/**
 * Whether the Live Chat screen is open right now. The global socket and foreground pushes check it so a support
 * message that arrives while the conversation is on screen does not raise the Support badge or re-display a
 * notification (the open screen marks it read itself). Cleared on sign-out.
 */
import { registerTeardown } from '@/store/auth';

let open = false;

export const liveChatSession = {
  isOpen: (): boolean => open,
  setOpen: (value: boolean): void => {
    open = value;
  },
};

registerTeardown(() => liveChatSession.setOpen(false));
