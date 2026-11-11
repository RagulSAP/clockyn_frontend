/**
 * Share channels of the referral message. Everything here is best-effort: a channel that is not available (WhatsApp not
 * installed, no SMS app, a browser without Web Share) falls back to the next one instead of failing the tap.
 *
 *  - Share:     system share sheet (RN `Share.share` on native, `navigator.share` on web, clipboard when neither exists).
 *  - WhatsApp:  `whatsapp://send?text=` on native, falling back to `https://wa.me/?text=` (opens WhatsApp when installed,
 *               a web page otherwise) and finally the share sheet. Web goes straight to `wa.me`.
 *  - SMS:       `sms:` link with the body; the separator differs (`?body=` Android / web, `&body=` iOS), falling back to the sheet.
 */
import { Linking, Platform } from 'react-native';

import { shareText, type ShareTextResult } from '@/lib/platform/share';

export const SHARE_TITLE = 'Join me on Clockyn';

export const whatsappAppUrl = (message: string): string => `whatsapp://send?text=${encodeURIComponent(message)}`;
export const whatsappWebUrl = (message: string): string => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** `sms:?body=` (Android, web) or `sms:&body=` (iOS: the empty recipient is skipped with `&`). */
export function smsUrl(message: string, os: string = Platform.OS): string {
  return `sms:${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** The text-message app only makes sense on a phone: always on native, on web only for touch devices. */
export function canSendSms(os: string = Platform.OS): boolean {
  if (os !== 'web') return true;
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0;
}

export type OpenOutcome = 'opened' | 'web' | 'sheet' | 'copied' | 'dismissed' | 'failed';

const fromShare = (r: ShareTextResult): OpenOutcome => (r === 'shared' ? 'sheet' : r);

/** System share sheet with the server's `share_message`. */
export async function shareReferral(message: string): Promise<OpenOutcome> {
  return fromShare(await shareText({ message, title: SHARE_TITLE }));
}

/** WhatsApp app -> wa.me -> share sheet. */
export async function shareViaWhatsApp(message: string, os: string = Platform.OS): Promise<OpenOutcome> {
  if (os !== 'web' && (await tryOpen(whatsappAppUrl(message)))) return 'opened';
  if (await tryOpen(whatsappWebUrl(message))) return os === 'web' ? 'opened' : 'web';
  return shareReferral(message);
}

/** SMS composer -> share sheet. */
export async function shareViaSms(message: string, os: string = Platform.OS): Promise<OpenOutcome> {
  if (await tryOpen(smsUrl(message, os))) return 'opened';
  return shareReferral(message);
}
