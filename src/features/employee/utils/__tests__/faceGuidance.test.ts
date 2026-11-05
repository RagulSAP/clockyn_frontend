import { ApiError } from '@/lib/api/errors';
import { mapPunchResult } from '@/api/mappers/face';

import { failureInfoOf, faceGuidance, isHolidayFailure, isNoFaceFailure, noFaceText, punchFailureText, registrationFailureText } from '../faceGuidance';

describe('mapPunchResult code / reason', () => {
  it('exposes known codes and reasons, drops unknown ones, and tolerates old servers', () => {
    expect(mapPunchResult({ success: false, message: 'x', code: 'no_face', reason: 'too_dark' })).toMatchObject({ code: 'no_face', reason: 'too_dark' });
    expect(mapPunchResult({ success: true, code: 'ok' })).toMatchObject({ code: 'ok' });
    const odd = mapPunchResult({ success: false, message: 'x', code: 'brand_new', reason: 'weird' });
    expect(odd.code).toBeUndefined();
    expect(odd.reason).toBeUndefined();
    expect(mapPunchResult({ success: false, message: 'No face detected' }).code).toBeUndefined();
  });
});

describe('guidance messages', () => {
  it('maps reasons and codes to specific text', () => {
    expect(faceGuidance({ code: 'no_face', reason: 'too_dark' })).toMatch(/too dark/);
    expect(faceGuidance({ code: 'image_unreadable', reason: 'too_blurry' })).toMatch(/steady/);
    expect(faceGuidance({ code: 'no_face' })).toMatch(/fill the oval/);
    expect(faceGuidance({ code: 'no_match' })).toMatch(/not recognised/);
    expect(faceGuidance({ code: 'max_sessions' })).toBeUndefined();
    expect(noFaceText({})).toMatch(/fill the oval/);
    expect(noFaceText({ reason: 'too_small' })).toMatch(/closer/);
  });

  it('falls back to the server message', () => {
    expect(punchFailureText({ message: 'Maximum 2 punch sessions per day reached.', code: 'max_sessions' })).toBe('Maximum 2 punch sessions per day reached.');
    expect(punchFailureText({ message: '' })).toMatch(/Punch failed/);
  });
});

describe('v1 retry conditions keyed by code, else by message', () => {
  it('no-face', () => {
    expect(isNoFaceFailure({ message: 'No face detected' })).toBe(true);
    expect(isNoFaceFailure({ message: 'No face detected', code: 'no_match' })).toBe(false);
    expect(isNoFaceFailure({ message: 'whatever', code: 'no_face' })).toBe(true);
    expect(isNoFaceFailure({ message: 'Face not recognized' })).toBe(false);
  });
  it('holiday', () => {
    expect(isHolidayFailure({ message: '', isHoliday: true })).toBe(true);
    expect(isHolidayFailure({ message: '', code: 'holiday_blocked' })).toBe(true);
    expect(isHolidayFailure({ message: '' })).toBe(false);
  });
});

describe('registration failures', () => {
  it('reads code / reason from the 400 body and keeps the v1 string rules', () => {
    const err = new ApiError({ status: 400, message: 'No face detected in photo 2', raw: { detail: 'No face detected in photo 2', code: 'no_face', reason: 'too_blurry' } });
    expect(registrationFailureText(err.message, failureInfoOf(err))).toMatch(/steady/);
    expect(registrationFailureText('No face detected in photo 2', { code: 'no_face' })).toMatch(/Face not visible/);
    expect(registrationFailureText('No face detected in photo 2')).toMatch(/Face not visible/);
    expect(registrationFailureText('Server busy')).toBe('Server busy');
    expect(failureInfoOf(new Error('x'))).toEqual({});
  });
});
