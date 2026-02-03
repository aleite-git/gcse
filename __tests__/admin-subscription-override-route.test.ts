import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const getDb = jest.fn();
const verifyIdToken = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    MOBILE_USERS: 'mobileUsers',
  },
}));

jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}));

let overridePost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: overridePost } = await import('@/app/api/admin/subscription-override/route'));
});

beforeEach(() => {
  getDb.mockReset();
  verifyIdToken.mockReset();
});

function createFirestoreMock(seed: Array<{ id: string; data: Record<string, unknown> }>) {
  const records = seed.map((record) => ({ ...record }));

  const collection = {
    doc: (id: string) => ({
      get: async () => {
        const record = records.find((item) => item.id === id);
        return {
          exists: Boolean(record),
          id,
          data: () => record?.data,
        };
      },
      update: async (update: Record<string, unknown>) => {
        const record = records.find((item) => item.id === id);
        if (record) {
          record.data = { ...record.data, ...update };
        }
      },
    }),
    where: (field: string, _op: string, value: unknown) => ({
      limit: (_limit: number) => ({
        get: async () => {
          const matches = records.filter((record) => record.data[field] === value);
          return {
            empty: matches.length === 0,
            docs: matches.map((record) => ({
              id: record.id,
              data: () => record.data,
            })),
          };
        },
      }),
    }),
  };

  return { collection, records };
}

describe('admin subscription override route', () => {
  it('rejects requests without a bearer token', async () => {
    getDb.mockReturnValue({ collection: jest.fn() });

    const request = new Request('http://localhost/api/admin/subscription-override', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', adminOverride: true }),
    }) as NextRequest;

    const response = await overridePost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('requires adminOverride in the payload', async () => {
    getDb.mockReturnValue({ collection: jest.fn() });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'tester' }),
    });

    const request = new Request('http://localhost/api/admin/subscription-override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify({ userId: 'user-1' }),
    }) as NextRequest;

    const response = await overridePost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'adminOverride must be true or false' });
  });

  it('requires a user id or email', async () => {
    getDb.mockReturnValue({ collection: jest.fn() });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'tester' }),
    });

    const request = new Request('http://localhost/api/admin/subscription-override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify({ adminOverride: true }),
    }) as NextRequest;

    const response = await overridePost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'Provide either userId or email' });
  });

  it('returns 404 when user is not found', async () => {
    const { collection } = createFirestoreMock([]);
    getDb.mockReturnValue({ collection: () => collection });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'tester' }),
    });

    const request = new Request('http://localhost/api/admin/subscription-override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify({ userId: 'missing', adminOverride: true }),
    }) as NextRequest;

    const response = await overridePost(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ error: 'User not found' });
  });

  it('updates adminOverride by email', async () => {
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: { emailLower: 'test@example.com', adminOverride: false },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: 'tester' }),
    });

    const request = new Request('http://localhost/api/admin/subscription-override', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: JSON.stringify({ email: 'Test@Example.com', adminOverride: true }),
    }) as NextRequest;

    const response = await overridePost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ userId: 'user-1', adminOverride: true });
    expect(records[0].data.adminOverride).toBe(true);
  });
});
