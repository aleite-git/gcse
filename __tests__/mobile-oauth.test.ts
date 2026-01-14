import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MobileAuthError } from '@/lib/mobile-auth';

const jwtVerify = jest.fn();
const createRemoteJWKSet = jest.fn(() => 'jwks');

jest.unstable_mockModule('jose', () => ({
  jwtVerify,
  createRemoteJWKSet,
}));

const { verifyGoogleIdToken, verifyAppleIdToken } = await import('@/lib/mobile-oauth');

describe('mobile oauth token verification', () => {
  beforeEach(() => {
    jwtVerify.mockReset();
    createRemoteJWKSet.mockClear();
  });

  it('verifies Google token and normalizes profile', async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: 'google-sub',
        email: 'User@Example.com',
        email_verified: 'true',
      },
    });

    const profile = await verifyGoogleIdToken('token', 'client-id');

    expect(profile).toMatchObject({
      provider: 'google',
      subject: 'google-sub',
      email: 'User@Example.com',
      emailLower: 'user@example.com',
      emailVerified: true,
    });
  });

  it('verifies Apple token and handles missing email verification', async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: 'apple-sub',
        email: 'user@example.com',
      },
    });

    const profile = await verifyAppleIdToken('token', 'client-id');

    expect(profile).toMatchObject({
      provider: 'apple',
      subject: 'apple-sub',
      email: 'user@example.com',
      emailLower: 'user@example.com',
      emailVerified: false,
    });
  });

  it('throws MobileAuthError when token verification fails', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('bad token'));

    await expect(verifyGoogleIdToken('token', 'client-id')).rejects.toBeInstanceOf(
      MobileAuthError
    );
  });

  it('throws MobileAuthError when subject is missing', async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        email: 'user@example.com',
      },
    });

    await expect(verifyAppleIdToken('token', 'client-id')).rejects.toMatchObject({
      message: 'Invalid OAuth token',
      status: 401,
    });
  });
});
