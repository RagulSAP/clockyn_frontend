/**
 * Share text / links through the platform share sheet (native `Share`, web `navigator.share`), falling
 * back to the clipboard on browsers without Web Share. For files use `shareFile` from `./files`.
 */
import { Platform, Share } from 'react-native';
import { copyToClipboard } from './clipboard';

export type ShareTextResult = 'shared' | 'copied' | 'dismissed' | 'failed';

export async function shareText(opts: { message: string; url?: string; title?: string }): Promise<ShareTextResult> {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      if (nav?.share) {
        await nav.share({ title: opts.title, text: opts.message, url: opts.url });
        return 'shared';
      }
      const copied = await copyToClipboard([opts.message, opts.url].filter(Boolean).join('\n'));
      return copied ? 'copied' : 'failed';
    }
    const result = await Share.share(
      { message: Platform.OS === 'ios' ? opts.message : [opts.message, opts.url].filter(Boolean).join('\n'), url: opts.url, title: opts.title },
      { dialogTitle: opts.title },
    );
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'dismissed';
    return 'failed';
  }
}
