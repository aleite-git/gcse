import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const getDb = jest.fn();
const getSessionFromRequest = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    MOBILE_USERS: 'mobileUsers',
    USER_PROFILES: 'userProfiles',
  },
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  getSessionFromRequest,
}));

let meGet: (request: NextRequest) => Promise<Response>;
let mePatch: (request: NextRequest) => Promise<Response>;
let subjectsPut: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ GET: meGet, PATCH: mePatch } = await import('@/app/api/v1/me/route'));
  ({ PUT: subjectsPut } = await import('@/app/api/v1/me/subjects/route'));
});

beforeEach(() => {
  getDb.mockReset();
  getSessionFromRequest.mockReset();
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
    add: async (data: Record<string, unknown>) => {
      const id = `seed-${records.length + 1}`;
      records.push({ id, data });
      return { id };
    },
    doc: (id: string) => ({
      update: async (update: Record<string, unknown>) => {
        const index = records.findIndex((record) => record.id === id);
        if (index >= 0) {
          records[index] = { ...records[index], data: { ...records[index].data, ...update } };
        }
      },
    }),
  };

  return { collection, records };
}

function createMultiCollectionMock(seed: Array<{ id?: string; data: Record<string, unknown> }> = []) {
  const mobile = createFirestoreMock(seed);
  const profiles = createFirestoreMock();

  return {
    mobile,
    profiles,
    getDbResult: {
      collection: (name: string) => {
        if (name === 'mobileUsers') return mobile.collection;
        if (name === 'userProfiles') return profiles.collection;
        throw new Error(`Unexpected collection: ${name}`);
      },
    },
  };
}

describe('mobile onboarding routes', () => {
  it('rejects empty subjects array', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          username: 'UserOne',
          usernameLower: 'userone',
          activeSubjects: [],
          onboardingComplete: false,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: [] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must contain at least one subject' });
  });

  it('rejects invalid subjects', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: { usernameLower: 'userone' },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Maths'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: "invalid subject: 'Maths'" });
  });

  it('rejects duplicate subjects', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: { usernameLower: 'userone' },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must not contain duplicates' });
  });

  it('accepts valid subjects and marks onboarding complete', async () => {
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: { usernameLower: 'userone' },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      activeSubjects: ['Biology'],
      onboardingComplete: true,
    });
    expect(records[0].data.activeSubjects).toEqual(['Biology']);
    expect(records[0].data.onboardingComplete).toBe(true);
  });

  it('rejects multiple subjects for free users', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: { usernameLower: 'userone' },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: 'Premium required to select multiple subjects',
    });
  });

  it('allows multiple subjects for premium users', async () => {
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          subscriptionExpiry: new Date('2999-01-01T00:00:00.000Z'),
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      activeSubjects: ['Biology', 'Chemistry'],
      onboardingComplete: true,
    });
    expect(records[0].data.activeSubjects).toEqual(['Biology', 'Chemistry']);
  });

  it('allows multiple subjects for admin overrides', async () => {
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          adminOverride: true,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      activeSubjects: ['Biology', 'Chemistry'],
      onboardingComplete: true,
    });
    expect(records[0].data.activeSubjects).toEqual(['Biology', 'Chemistry']);
  });

  it('returns stored profile on GET', async () => {
    const { getDbResult, mobile } = createMultiCollectionMock([
      {
        id: 'user-1',
        data: {
          username: 'UserOne',
          usernameLower: 'userone',
          activeSubjects: ['Chemistry'],
          onboardingComplete: true,
        },
      },
    ]);
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me', { method: 'GET' }) as NextRequest;
    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: 'user-1',
      username: 'UserOne',
      activeSubjects: ['Chemistry'],
      onboardingComplete: true,
    });
    expect(mobile.records.length).toBe(1);
  });

  it('uses defaults when optional profile fields are missing', async () => {
    // Covers username fallback + default onboarding values.
    const { getDbResult } = createMultiCollectionMock([
      {
        id: 'user-2',
        data: {
          usernameLower: 'userone',
        },
      },
    ]);
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me', { method: 'GET' }) as NextRequest;
    const response = await meGet(request);
    const payload = await response.json();

    expect(payload).toMatchObject({
      username: null,
      activeSubjects: [],
      onboardingComplete: false,
    });
  });

  it('creates a profile for access-code users without mobile records', async () => {
    const { getDbResult, profiles } = createMultiCollectionMock();
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me', { method: 'GET' }) as NextRequest;
    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      activeSubjects: ['Biology', 'Chemistry', 'Computer Science'],
      onboardingComplete: true,
    });
    expect(profiles.records.length).toBe(1);
  });

  it('returns existing access-code profile when present', async () => {
    const { getDbResult, profiles } = createMultiCollectionMock();
    profiles.records.push({
      id: 'profile-1',
      data: {
        label: 'UserOne',
        labelLower: 'userone',
        activeSubjects: ['Biology'],
        onboardingComplete: true,
        productId: 'pro',
        store: 'app_store',
        environment: 'sandbox',
        revenueCatAppUserId: 'rc-user',
        lastRevenueCatEventId: 'evt-1',
      },
    });
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me', { method: 'GET' }) as NextRequest;
    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      id: 'profile-1',
      productId: 'pro',
      store: 'app_store',
      environment: 'sandbox',
      revenueCatAppUserId: 'rc-user',
      lastRevenueCatEventId: 'evt-1',
    });
    expect(profiles.records.length).toBe(1);
  });

  it('rejects me requests when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    getDb.mockReturnValue({ collection: jest.fn() });

    const request = new Request('http://localhost/api/v1/me', { method: 'GET' }) as NextRequest;
    const response = await meGet(request);
    expect(response.status).toBe(401);
  });

  it('rejects me patch requests when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    getDb.mockReturnValue({ collection: jest.fn() });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    }) as NextRequest;
    const response = await mePatch(request);
    expect(response.status).toBe(401);
  });

  it('rejects onboarding completion without subjects', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          activeSubjects: [],
          onboardingComplete: false,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true, activeSubjects: [] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must contain at least one subject' });
  });

  it('rejects completion when subjects are missing from the patch body', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          activeSubjects: [],
          onboardingComplete: false,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must contain at least one subject' });
  });

  it('rejects multiple subjects in profile patch for free users', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          activeSubjects: ['Biology'],
          onboardingComplete: true,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({
      error: 'Premium required to select multiple subjects',
    });
  });

  it('allows multiple subjects for premium users in profile patch', async () => {
    const { collection } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          activeSubjects: ['Biology'],
          onboardingComplete: true,
          subscriptionExpiry: new Date('2999-01-01T00:00:00.000Z'),
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Biology', 'Chemistry']);
  });

  it('updates profiles for access-code users', async () => {
    const { getDbResult, profiles } = createMultiCollectionMock([
      {
        id: 'profile-1',
        data: {
          label: 'UserOne',
          labelLower: 'userone',
          activeSubjects: ['Biology'],
          onboardingComplete: false,
        },
      },
    ]);
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'], onboardingComplete: true }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.onboardingComplete).toBe(true);
    expect(profiles.records[0].data.onboardingComplete).toBe(true);
  });

  it('allows empty subjects while onboarding is incomplete', async () => {
    // Covers the allowEmpty branch for activeSubjects validation.
    const { collection, records } = createFirestoreMock([
      {
        id: 'user-1',
        data: {
          usernameLower: 'userone',
          activeSubjects: [],
          onboardingComplete: false,
        },
      },
    ]);
    getDb.mockReturnValue({ collection: () => collection });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: [], onboardingComplete: false }),
    }) as NextRequest;

    const response = await mePatch(request);
    expect(response.status).toBe(200);
    expect(records[0].data.activeSubjects).toEqual([]);
    expect(records[0].data.onboardingComplete).toBe(false);
  });

  it('rejects subjects updates when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    getDb.mockReturnValue({ collection: jest.fn() });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;
    const response = await subjectsPut(request);
    expect(response.status).toBe(401);
  });

  it('returns 404 when subjects user is missing', async () => {
    const { getDbResult } = createMultiCollectionMock();
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;
    const response = await subjectsPut(request);
    expect(response.status).toBe(404);
  });

  it('updates subjects for access-code profiles', async () => {
    const { getDbResult, profiles } = createMultiCollectionMock();
    profiles.records.push({
      id: 'profile-1',
      data: {
        label: 'UserOne',
        labelLower: 'userone',
        activeSubjects: ['Biology'],
        onboardingComplete: false,
        productId: 'pro',
        store: 'app_store',
        environment: 'sandbox',
        revenueCatAppUserId: 'rc-user',
        lastRevenueCatEventId: 'evt-1',
      },
    });
    getDb.mockReturnValue(getDbResult);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;
    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.productId).toBe('pro');
    expect(profiles.records[0].data.onboardingComplete).toBe(true);
  });
});
