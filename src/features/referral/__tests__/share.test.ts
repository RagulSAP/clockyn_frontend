import { Linking } from 'react-native';

import { shareText } from '@/lib/platform/share';

import { canSendSms, shareReferral, shareViaSms, shareViaWhatsApp, smsUrl, whatsappAppUrl, whatsappWebUrl } from '../utils/share';
import { normalizeReferralCode } from '../utils/code';

jest.mock('@/lib/platform/share', () => ({ shareText: jest.fn() }));

const share = shareText as jest.Mock;
const MSG = 'Use my code K7M2QX & save 10%';
const ENC = encodeURIComponent(MSG);
let open: jest.SpyInstance;

beforeEach(() => {
  share.mockReset().mockResolvedValue('shared');
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
});
afterEach(() => open.mockRestore());

describe('urls', () => {
  it('encodes the message for WhatsApp (app and web)', () => {
    expect(whatsappAppUrl(MSG)).toBe(`whatsapp://send?text=${ENC}`);
    expect(whatsappWebUrl(MSG)).toBe(`https://wa.me/?text=${ENC}`);
  });

  it('uses the platform-correct SMS body separator', () => {
    expect(smsUrl(MSG, 'ios')).toBe(`sms:&body=${ENC}`);
    expect(smsUrl(MSG, 'android')).toBe(`sms:?body=${ENC}`);
    expect(smsUrl(MSG, 'web')).toBe(`sms:?body=${ENC}`);
  });

  it('shows the SMS action on native always and on web only for touch devices', () => {
    expect(canSendSms('android')).toBe(true);
    expect(canSendSms('ios')).toBe(true);
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true });
    expect(canSendSms('web')).toBe(false);
    Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5 }, configurable: true });
    expect(canSendSms('web')).toBe(true);
    if (original) Object.defineProperty(globalThis, 'navigator', original);
  });
});

describe('shareReferral', () => {
  it('goes through the system share sheet with the server message', async () => {
    await expect(shareReferral(MSG)).resolves.toBe('sheet');
    expect(share).toHaveBeenCalledWith({ message: MSG, title: 'Join me on Clockyn' });
  });

  it('passes dismissed / copied / failed through', async () => {
    share.mockResolvedValueOnce('dismissed');
    await expect(shareReferral(MSG)).resolves.toBe('dismissed');
    share.mockResolvedValueOnce('copied');
    await expect(shareReferral(MSG)).resolves.toBe('copied');
    share.mockResolvedValueOnce('failed');
    await expect(shareReferral(MSG)).resolves.toBe('failed');
  });
});

describe('shareViaWhatsApp', () => {
  it('opens the WhatsApp app first on native', async () => {
    await expect(shareViaWhatsApp(MSG, 'android')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(whatsappAppUrl(MSG));
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back to wa.me when the app link cannot be opened', async () => {
    open.mockRejectedValueOnce(new Error('no app'));
    await expect(shareViaWhatsApp(MSG, 'ios')).resolves.toBe('web');
    expect(open).toHaveBeenNthCalledWith(2, whatsappWebUrl(MSG));
  });

  it('falls back to the share sheet when nothing opens', async () => {
    open.mockRejectedValue(new Error('nope'));
    await expect(shareViaWhatsApp(MSG, 'android')).resolves.toBe('sheet');
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('goes straight to wa.me on the web', async () => {
    await expect(shareViaWhatsApp(MSG, 'web')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(whatsappWebUrl(MSG));
  });
});

describe('shareViaSms', () => {
  it('opens the composer, else the share sheet', async () => {
    await expect(shareViaSms(MSG, 'android')).resolves.toBe('opened');
    expect(open).toHaveBeenCalledWith(smsUrl(MSG, 'android'));
    open.mockRejectedValueOnce(new Error('no sms app'));
    await expect(shareViaSms(MSG, 'ios')).resolves.toBe('sheet');
    expect(share).toHaveBeenCalledTimes(1);
  });
});

describe('normalizeReferralCode', () => {
  it('upper-cases, drops non-alphanumerics and caps at 6', () => {
    expect(normalizeReferralCode('k7m-2qx9!')).toBe('K7M2QX');
    expect(normalizeReferralCode(' ab 12 ')).toBe('AB12');
    expect(normalizeReferralCode('')).toBe('');
  });
});
