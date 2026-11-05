/**
 * Session-lifetime chat memory: which received images the user has revealed ("Tap to view") and which files were
 * already downloaded. v1 kept these in module-level collections that were never cleared on logout; here they are
 * emptied by the sign-out teardown, so the next user starts clean.
 */
import { registerTeardown } from '@/store/auth';
import { stableImageKey } from '@/components/ui';

const revealedImages = new Set<string>();
const downloadedFiles = new Set<string>();
const openConversation = { direct: null as string | null, group: null as string | null };

/** Revealed images are remembered by their URL without the (rotating) signature. */
export const isImageRevealed = (url: string): boolean => revealedImages.has(stableImageKey(url));
export const markImageRevealed = (url: string): void => {
  revealedImages.add(stableImageKey(url));
};

export const isFileDownloaded = (url: string): boolean => downloadedFiles.has(stableImageKey(url));
export const markFileDownloaded = (url: string): void => {
  downloadedFiles.add(stableImageKey(url));
};

/**
 * Which conversation is currently open on top of a list. The list underneath pauses its own socket handling for
 * it (the open conversation settles its own messages), so one message is never counted twice.
 */
export const openConversationRegistry = {
  direct: (): string | null => openConversation.direct,
  group: (): string | null => openConversation.group,
  setDirect: (peerId: string | null): void => {
    openConversation.direct = peerId;
  },
  setGroup: (groupId: string | null): void => {
    openConversation.group = groupId;
  },
};

export function resetChatSessionMemory(): void {
  revealedImages.clear();
  downloadedFiles.clear();
  openConversation.direct = null;
  openConversation.group = null;
}

registerTeardown(() => resetChatSessionMemory());
