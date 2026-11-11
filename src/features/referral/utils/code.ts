/** A referral code is exactly 6 upper-case letters / digits (the server never issues 0 O 1 I L, but typed input is only filtered). */
export const REFERRAL_CODE_LENGTH = 6;

/** Normalises typed / pasted text into the code alphabet: upper-case, alphanumeric only, at most 6 characters. */
export function normalizeReferralCode(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, REFERRAL_CODE_LENGTH);
}

export const isCompleteReferralCode = (code: string): boolean => code.length === REFERRAL_CODE_LENGTH;
