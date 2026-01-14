import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { MobileAuthError } from '@/lib/mobile-auth';

const getDb = jest.fn();
const createSessionToken = jest.fn();
const getSessionFromRequest = jest.fn();
const verifyGoogleIdToken = jest.fn();
const verifyAppleIdToken = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    MOBILE_USERS: 'mobileUsers',
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  createSessionToken,
  getSessionFromRequest,
}));
jest.unstable_mockModule('@/lib/mobile-oauth', () => ({
  verifyGoogleIdToken,
  verifyAppleIdToken,
}));

let registerPost: (request: NextRequest) => Promise<Response>;
let loginPost: (request: NextRequest) => Promise<Response>;
let updateUsernamePost: (request: NextRequest) => Promise<Response>;
let checkUsernameGet: (request: NextRequest) => Promise<Response>;
let googleOauthPost: (request: NextRequest) => Promise<Response>;
let appleOauthPost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: registerPost } = await import('@/app/api/mobile/register/route'));
  ({ POST: loginPost } = await import('@/app/api/mobile/login/route'));
  ({ POST: updateUsernamePost } = await import('@/app/api/mobile/username/update/route'));
  ({ GET: checkUsernameGet } = await import('@/app/api/mobile/username/check/route'));
  ({ POST: googleOauthPost } = await import('@/app/api/mobile/oauth/google/route'));
  ({ POST: appleOauthPost } = await import('@/app/api/mobile/oauth/apple/route'));
});

beforeEach(() => {
  getDb.mockReset();
  createSessionToken.mockReset();
  getSessionFromRequest.mockReset();
  verifyGoogleIdToken.mockReset();
  verifyAppleIdToken.mockReset();
  createSessionToken.mockResolvedValue('token-123');
  getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
});

function createFirestoreMock(seed: Array<{ id?: string; data: Record<string, unknown> }> = []) {
  const records = seed.map((record, index) => ({
    id: record.id ?? `seed-${index + 1}`,
    data: record.data,
  }));

  const buildQuery = (filters: Array<{ field: string; value: unknown }>) => ({
    where: (field: string, _op: string, value: unknown) =>
      buildQuery([...filters, { field, value }]),
    limit: (_limit: number) => ({
      get: async () => {
        const matches = records.filter((record) =>
          filters.every((filter) => record.data[filter.field] === filter.value)
        );
        return {
          empty: matches.length === 0,
          docs: matches.map((record) => ({
            id: record.id,
            data: () => record.data,
          })),
        };
      },
    }),
  });

  const collection = {
    where: (field: string, _op: string, value: unknown) =>
      buildQuery([{ field, value }]),
    doc: (id: string) => ({
      update: async (update: Record<string, unknown>) => {
        const index = records.findIndex((record) => record.id === id);
        if (index >= 0) {
          records[index] = { ...records[index], data: { ...records[index].data, ...update } };
        }
      },
    }),
    add: async (data: Record<string, unknown>) => {
      const id = `user-${records.length + 1}`;
      records.push({ id, data });
      return { id };
    },
  };

  return { collection, records };
}

describe('mobile auth routes', () => {
  it('registers a user and returns a token', async () => {
    const { collection, records } = createFirestoreMock();
    getDb.mockReturnValue({
      collection: (name: string) => {
        expect(name).toBe('mobileUsers');
        return collection;
      },
    });

    const request = new Request('http://localhost/api/mobile/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'User@Example.com',
        password: 'Password1',
        username: 'Valid_User',
      }),
    }) as NextRequest;

    const response = await registerPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'Valid_User',
    });
    expect(createSessionToken).toHaveBeenCalledWith('Valid_User', false);
    expect(records[0].data.emailLower).toBe('user@example.com');
    expect(records[0].data.usernameLower).toBe('valid_user');
  });

  it('returns 409 for duplicate email on registration', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'existing@example.com',
          emailLower: 'existing@example.com',
          passwordHash,
          username: 'ExistingUser',
          usernameLower: 'existinguser',
          usernameChangeCount: 0,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({
      collection: () => collection,
    });

    const request = new Request('http://localhost/api/mobile/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'existing@example.com',
        password: 'Password1',
        username: 'NewUser',
      }),
    }) as NextRequest;

    const response = await registerPost(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: 'Email already in use' });
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it('returns 500 when registration token creation fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });
    createSessionToken.mockRejectedValueOnce(new Error('boom'));

    const request = new Request('http://localhost/api/mobile/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'Password1',
        username: 'Valid_User',
      }),
    }) as NextRequest;

    const response = await registerPost(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred during registration' });
    consoleSpy.mockRestore();
  });

  it('logs in a user and returns a token', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash,
          username: 'UserOne',
          usernameLower: 'userone',
          usernameChangeCount: 1,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'Password1',
      }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'UserOne',
    });
    expect(createSessionToken).toHaveBeenCalledWith('UserOne', false);
  });

  it('logs in a user with username and returns a token', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash,
          username: 'UserOne',
          usernameLower: 'userone',
          usernameChangeCount: 1,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'UserOne',
        password: 'Password1',
      }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'UserOne',
    });
    expect(createSessionToken).toHaveBeenCalledWith('UserOne', false);
  });

  it('returns 401 for invalid password on login', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash,
          username: 'UserOne',
          usernameLower: 'userone',
          usernameChangeCount: 1,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'WrongPassword',
      }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Invalid username or password' });
    expect(createSessionToken).not.toHaveBeenCalled();
  });

  it('returns 401 for unknown user on login', async () => {
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'missing@example.com',
        password: 'Password1',
      }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Invalid username or password' });
  });

  it('returns 500 when login token creation fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash,
          username: 'UserOne',
          usernameLower: 'userone',
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });
    createSessionToken.mockRejectedValueOnce(new Error('boom'));

    const request = new Request('http://localhost/api/mobile/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'Password1',
      }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred during login' });
    consoleSpy.mockRestore();
  });

  it('updates username and returns a new token', async () => {
    const passwordHash = await bcrypt.hash('Password1', 12);
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash,
          username: 'UserOne',
          usernameLower: 'userone',
          usernameChangeCount: 1,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/username/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'NewUser' }),
    }) as NextRequest;

    const response = await updateUsernamePost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'NewUser',
      remainingChanges: 1,
    });
    expect(createSessionToken).toHaveBeenCalledWith('NewUser', false);
    expect(records[0].data.usernameLower).toBe('newuser');
    expect(records[0].data.usernameChangeCount).toBe(2);
  });

  it('returns 401 when updating username without session', async () => {
    getSessionFromRequest.mockResolvedValueOnce(null);
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/username/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'NewUser' }),
    }) as NextRequest;

    const response = await updateUsernamePost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 400 for invalid usernames on update', async () => {
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/mobile/username/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'bad' }),
    }) as NextRequest;

    const response = await updateUsernamePost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Username must be 5-15 characters' });
  });

  it('checks username availability', async () => {
    const { collection } = createFirestoreMock([
      {
        data: {
          email: 'user@example.com',
          emailLower: 'user@example.com',
          passwordHash: await bcrypt.hash('Password1', 12),
          username: 'UserOne',
          usernameLower: 'userone',
          usernameChangeCount: 0,
          createdAt: new Date(),
        },
      },
    ]);

    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request(
      'http://localhost/api/mobile/username/check?username=UserOne',
      { method: 'GET' }
    ) as NextRequest;

    const response = await checkUsernameGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      available: false,
      reason: 'Username already in use',
    });
  });

  it('returns 400 for invalid username check', async () => {
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request(
      'http://localhost/api/mobile/username/check?username=bad',
      { method: 'GET' }
    ) as NextRequest;

    const response = await checkUsernameGet(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Username must be 5-15 characters' });
  });

  it('logs in with Google OAuth', async () => {
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });
    verifyGoogleIdToken.mockResolvedValue({
      provider: 'google',
      subject: 'subject-123',
      email: 'user@example.com',
      emailLower: 'user@example.com',
      emailVerified: true,
    });
    process.env.GOOGLE_CLIENT_ID = 'google-client';

    const request = new Request('http://localhost/api/mobile/oauth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idToken: 'token-123',
        username: 'NewUser',
      }),
    }) as NextRequest;

    const response = await googleOauthPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'NewUser',
    });
    expect(createSessionToken).toHaveBeenCalledWith('NewUser', false);
  });

  it('returns 400 when Google idToken is missing', async () => {
    const request = new Request('http://localhost/api/mobile/oauth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await googleOauthPost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'ID token is required' });
  });

  it('returns 500 when Google client ID is missing', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const request = new Request('http://localhost/api/mobile/oauth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'token-123' }),
    }) as NextRequest;

    const response = await googleOauthPost(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'Google client ID not configured' });
  });

  it('logs in with Apple OAuth', async () => {
    const { collection } = createFirestoreMock();
    getDb.mockReturnValue({ collection: () => collection });
    verifyAppleIdToken.mockResolvedValue({
      provider: 'apple',
      subject: 'subject-apple',
      email: 'user@example.com',
      emailLower: 'user@example.com',
      emailVerified: true,
    });
    process.env.APPLE_CLIENT_ID = 'apple-client';

    const request = new Request('http://localhost/api/mobile/oauth/apple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idToken: 'token-apple',
        username: 'NewUser',
      }),
    }) as NextRequest;

    const response = await appleOauthPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      token: 'token-123',
      username: 'NewUser',
    });
    expect(createSessionToken).toHaveBeenCalledWith('NewUser', false);
  });

  it('returns 401 when Apple token is invalid', async () => {
    verifyAppleIdToken.mockRejectedValueOnce(new MobileAuthError('Invalid token', 401));
    process.env.APPLE_CLIENT_ID = 'apple-client';

    const request = new Request('http://localhost/api/mobile/oauth/apple', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'token-apple' }),
    }) as NextRequest;

    const response = await appleOauthPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Invalid token' });
  });
});
