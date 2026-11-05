import { ApiError, api } from '@/lib/api/client';

import { DEVICE_MISMATCH_MESSAGE, verifyOtp } from '../auth';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual('@/lib/api/client');
  return { ...actual, api: { ...actual.api, post: jest.fn() } };
});

const post = api.post as jest.Mock;
const input = { contact: '9000000003', otp: '123456', purpose: 'login' as const };

describe('verifyOtp: ENFORCE_SINGLE_DEVICE answers 409 device_mismatch', () => {
  it('turns the machine code into a readable message (status kept)', async () => {
    post.mockRejectedValue(new ApiError({ status: 409, message: 'device_mismatch', detail: 'device_mismatch' }));
    await expect(verifyOtp(input)).rejects.toMatchObject({ status: 409, message: DEVICE_MISMATCH_MESSAGE });
  });

  it('leaves every other failure untouched', async () => {
    const other = new ApiError({ status: 409, message: 'Something else', detail: 'Something else' });
    post.mockRejectedValue(other);
    await expect(verifyOtp(input)).rejects.toBe(other);
    const wrong = new ApiError({ status: 400, message: 'Invalid OTP', detail: 'Invalid OTP' });
    post.mockRejectedValue(wrong);
    await expect(verifyOtp(input)).rejects.toBe(wrong);
  });

  it('still returns the token fields on success', async () => {
    post.mockResolvedValue({ success: true, device_token: 'd1', user_exists: true, role_id: 3, access_token: 't1', expires_in: 60 });
    await expect(verifyOtp(input)).resolves.toMatchObject({ deviceToken: 'd1', accessToken: 't1' });
  });
});
