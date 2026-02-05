import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const validateAccessCode = jest.fn();
const createSessionToken = jest.fn();

jest.unstable_mockModule('@/lib/auth', () => ({
  validateAccessCode,
  createSessionToken,
}));

let loginMobilePost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: loginMobilePost } = await import('@/app/api/login/mobile/route'));
});

beforeEach(() => {
  validateAccessCode.mockReset();
  createSessionToken.mockReset();
  createSessionToken.mockResolvedValue('token');
});

describe('login mobile route', () => {
  it('returns token when access code is valid', async () => {
    validateAccessCode.mockResolvedValue({ label: 'Student', isAdmin: false });

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(payload.token).toBe('token');
    expect(payload.label).toBe('Student');
  });
});
