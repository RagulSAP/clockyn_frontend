/**
 * Pure validation helpers for the auth / registration screens (spec: 00_entry_auth/*).
 * All "error" helpers return '' when the value is acceptable (and for an empty optional value).
 */

export const MOBILE_RE = /^\d{10}$/;
export const PIN_RE = /^\d{6}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
export const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MOBILE_LENGTH = 10;
export const OTP_LENGTH = 6;
export const PIN_LENGTH = 6;

export const MOBILE_EXISTS_MESSAGE = 'Mobile number already registered';
export const EMAIL_EXISTS_MESSAGE = 'Email already registered';
export const INVALID_MOBILE_MESSAGE = 'Enter a valid 10-digit mobile number';
export const INVALID_EMAIL_MESSAGE = 'Enter a valid email address';
export const INVALID_PIN_MESSAGE = 'Enter a valid 6-digit pincode';
export const INVALID_PAN_MESSAGE = 'Invalid PAN format (e.g., ABCDE1234F)';
export const INVALID_CIN_MESSAGE = 'Invalid CIN format';
export const INVALID_TAN_MESSAGE = 'Invalid TAN format (e.g., ABCD12345E)';
export const INVALID_GST_MESSAGE = 'Invalid GST number (e.g., 22AAAAA0000A1Z5)';
export const REGISTER_GUARD_MESSAGE = 'Please fill all required fields and verify mobile & email';

/** Keep digits only, optionally capped at `max` characters. */
export function digitsOnly(value: string, max?: number): string {
  const digits = value.replace(/\D/g, '');
  return max === undefined ? digits : digits.slice(0, max);
}

/** Exactly 10 digits, no country code. */
export function isValidMobile(value: string): boolean {
  return MOBILE_RE.test(value);
}

/** Trimmed + lower-cased e-mail (the server stores it lower-case). */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** `name@domain.tld` shape (v1 only checked for an `@`). */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** The login id typed on the sign-in screens: a mobile number (`otp` mode) or an e-mail address (`email` mode). */
export function isValidLoginId(mode: 'otp' | 'email', value: string): boolean {
  return mode === 'email' ? isValidEmail(value) : isValidMobile(value);
}

/** Required 6-digit numeric pincode. */
export function isValidPincode(value: string): boolean {
  return PIN_RE.test(value);
}

export function pincodeError(value: string): string {
  return value === '' || isValidPincode(value) ? '' : INVALID_PIN_MESSAGE;
}

export function emailError(value: string): string {
  return value.trim() === '' || isValidEmail(value) ? '' : INVALID_EMAIL_MESSAGE;
}

const optionalPattern = (value: string, re: RegExp, message: string): string => (value === '' || re.test(value) ? '' : message);

export function panError(value: string): string {
  return optionalPattern(value, PAN_RE, INVALID_PAN_MESSAGE);
}

export function cinError(value: string): string {
  return optionalPattern(value, CIN_RE, INVALID_CIN_MESSAGE);
}

export function tanError(value: string): string {
  return optionalPattern(value, TAN_RE, INVALID_TAN_MESSAGE);
}

export function gstError(value: string): string {
  return optionalPattern(value, GST_RE, INVALID_GST_MESSAGE);
}

/** Upper-case + strip whitespace for the statutory identifiers (PAN, CIN, TAN, GST). */
export function normalizeStatutoryId(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}
