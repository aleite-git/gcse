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
    expect(response.status).toBe(200);
    expect(payload.token).toBe('token');
    expect(payload.label).toBe('Student');
    expect(payload.success).toBe(true);
    expect(payload.isAdmin).toBe(false);
    expect(createSessionToken).toHaveBeenCalledWith('Student', false);
  });

  it('returns token with isAdmin true for admin codes', async () => {
    validateAccessCode.mockResolvedValue({ label: 'Admin', isAdmin: true });

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'admin-code' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.isAdmin).toBe(true);
    expect(createSessionToken).toHaveBeenCalledWith('Admin', true);
  });

  it('returns 400 when code is missing', async () => {
    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Access code is required' });
    expect(validateAccessCode).not.toHaveBeenCalled();
  });

  it('returns 400 when code is null', async () => {
    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: null }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Access code is required' });
  });

  it('returns 400 when code is a number instead of a string', async () => {
    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 12345 }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Access code is required' });
  });

  it('returns 401 when access code is invalid', async () => {
    validateAccessCode.mockResolvedValue(null);

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'wrong-code' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Invalid access code' });
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it('trims whitespace from the code before validating', async () => {
    validateAccessCode.mockResolvedValue({ label: 'Student', isAdmin: false });

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '  abc  ' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    expect(response.status).toBe(200);
    expect(validateAccessCode).toHaveBeenCalledWith('abc');
  });

  it('returns 500 when validateAccessCode throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateAccessCode.mockRejectedValue(new Error('db connection failed'));

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred during login' });
    consoleSpy.mockRestore();
  });

  it('returns 500 when createSessionToken throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    validateAccessCode.mockResolvedValue({ label: 'Student', isAdmin: false });
    createSessionToken.mockRejectedValue(new Error('token signing failed'));

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred during login' });
    consoleSpy.mockRestore();
  });

  it('returns 500 when request body is not valid JSON', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const request = new Request('http://localhost/api/login/mobile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    }) as NextRequest;

    const response = await loginMobilePost(request);
    const payload = await response.json();
    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred during login' });
    consoleSpy.mockRestore();
  });
});
