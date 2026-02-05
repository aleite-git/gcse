import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { COLLECTIONS, createFirestoreMock } from './helpers/firestore';

const getDb = jest.fn();
const getSessionFromRequest = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

jest.unstable_mockModule('@/lib/auth', () => ({
  getSessionFromRequest,
}));

let identifyPost: (request: NextRequest) => Promise<Response>;
let syncPost: (request: NextRequest) => Promise<Response>;
let webhookPost: (request: NextRequest) => Promise<Response>;

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeAll(async () => {
  ({ POST: identifyPost } = await import('@/app/api/v1/subscription/identify/route'));
  ({ POST: syncPost } = await import('@/app/api/v1/subscription/sync/route'));
  ({ POST: webhookPost } = await import('@/app/api/v1/subscription/webhook/route'));
});

beforeEach(() => {
  getDb.mockReset();
  getSessionFromRequest.mockReset();
  getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
  process.env.REVENUECAT_WEBHOOK_AUTH = 'secret';
  process.env.REVENUECAT_API_KEY = 'api-key';
  delete process.env.REVENUECAT_WEBHOOK_AUTH_HEADER;
  delete process.env.REVENUECAT_ENTITLEMENT;
  global.fetch = jest.fn();
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
  global.fetch = originalFetch;
});

function seedUsers(seed: Record<string, Record<string, unknown>>) {
  const { db, store } = createFirestoreMock({
    [COLLECTIONS.MOBILE_USERS]: seed,
  });
  getDb.mockReturnValue(db);
  return { store };
}

function getUser(store: Map<string, Map<string, Record<string, unknown>>>, id: string) {
  return store.get(COLLECTIONS.MOBILE_USERS)?.get(id);
}

describe('revenuecat identify route', () => {
  it('rejects unauthorized requests', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revenueCatAppUserId: 'rc-user-1' }),
    }) as NextRequest;

    const response = await identifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('validates request body and user existence', async () => {
    seedUsers({ user1: { usernameLower: 'userone' } });
    const invalidRequest = new Request('http://localhost/api/v1/subscription/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    }) as NextRequest;
    const invalidResponse = await identifyPost(invalidRequest);
    expect(invalidResponse.status).toBe(400);

    seedUsers({});
    const missingUserRequest = new Request('http://localhost/api/v1/subscription/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revenueCatAppUserId: 'rc-user-1' }),
    }) as NextRequest;
    const missingUserResponse = await identifyPost(missingUserRequest);
    expect(missingUserResponse.status).toBe(404);
  });

  it('stores the revenuecat app user id', async () => {
    const { store } = seedUsers({
      user1: { usernameLower: 'userone' },
    });

    const request = new Request('http://localhost/api/v1/subscription/identify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revenueCatAppUserId: 'rc-user-1' }),
    }) as NextRequest;

    const response = await identifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ revenueCatAppUserId: 'rc-user-1' });
    expect(getUser(store, 'user1')).toMatchObject({
      revenueCatAppUserId: 'rc-user-1',
      subscriptionProvider: 'revenuecat',
    });
  });
});

describe('revenuecat sync route', () => {
  it('rejects unauthorized or misconfigured requests', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    expect(response.status).toBe(401);

    getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
    delete process.env.REVENUECAT_API_KEY;

    const responseMissingKey = await syncPost(request);
    expect(responseMissingKey.status).toBe(500);
  });

  it('returns errors when user or RevenueCat subscriber is missing', async () => {
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    expect(response.status).toBe(404);

    seedUsers({ user1: { usernameLower: 'userone' } });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const responseNotFound = await syncPost(request);
    expect(responseNotFound.status).toBe(404);
  });

  it('bubbles RevenueCat sync failures', async () => {
    seedUsers({ user1: { usernameLower: 'userone' } });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    expect(response.status).toBe(502);
  });

  it('syncs entitlement data from RevenueCat', async () => {
    const now = Date.now();
    const { store } = seedUsers({
      user1: { usernameLower: 'userone' },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        subscriber: {
          entitlements: {
            premium: {
              expires_date_ms: now + 86400000,
              grace_period_expires_date_ms: now + 2 * 86400000,
              purchase_date_ms: now - 86400000,
              product_identifier: 'pro_monthly',
              store: 'APP_STORE',
            },
          },
          environment: 'SANDBOX',
        },
      }),
    });

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      revenueCatAppUserId: 'user1',
      entitlement: 'premium',
      subscriptionStatus: 'active',
      productId: 'pro_monthly',
      store: 'app_store',
      environment: 'sandbox',
    });
    expect(getUser(store, 'user1')).toMatchObject({
      entitlement: 'premium',
      subscriptionStatus: 'active',
      productId: 'pro_monthly',
      store: 'app_store',
      environment: 'sandbox',
    });
  });

  it('marks status unknown when entitlement is missing', async () => {
    seedUsers({
      user1: { usernameLower: 'userone' },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        subscriber: {
          entitlements: {},
        },
      }),
    });

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      entitlement: 'free',
      subscriptionStatus: 'unknown',
    });
  });

  it('uses revenuecat app user ids and marks expired entitlements', async () => {
    // Covers app-user-id lookup + expired entitlements + product_id fallback.
    const now = Date.now();
    seedUsers({
      user1: { usernameLower: 'userone', revenueCatAppUserId: 'rc-user-1' },
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        subscriber: {
          entitlements: {
            premium: {
              expires_date_ms: now - 60 * 1000,
              purchase_date_ms: now - 2 * 60 * 60 * 1000,
              product_id: 'legacy_monthly',
              store: 'PLAY_STORE',
              environment: 'PRODUCTION',
            },
          },
        },
      }),
    });

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    const payload = await response.json();

    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('rc-user-1');
    expect(payload).toMatchObject({
      entitlement: 'free',
      subscriptionStatus: 'expired',
      productId: 'legacy_monthly',
      store: 'play_store',
      environment: 'production',
    });
  });

  it('returns unknown status when subscriber payload is missing', async () => {
    // Covers the path where RevenueCat returns no subscriber object.
    seedUsers({ user1: { usernameLower: 'userone' } });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const request = new Request('http://localhost/api/v1/subscription/sync', {
      method: 'POST',
    }) as NextRequest;
    const response = await syncPost(request);
    const payload = await response.json();

    expect(payload).toMatchObject({
      entitlement: 'free',
      subscriptionStatus: 'unknown',
    });
  });
});

describe('revenuecat webhook route', () => {
  it('requires webhook auth configuration', async () => {
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await webhookPost(request);
    expect(response.status).toBe(500);
  });

  it('validates auth and payload fields', async () => {
    seedUsers({});

    const unauthorized = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;
    const unauthorizedResponse = await webhookPost(unauthorized);
    expect(unauthorizedResponse.status).toBe(401);

    const invalidJson = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: '{',
    }) as NextRequest;
    const invalidJsonResponse = await webhookPost(invalidJson);
    expect(invalidJsonResponse.status).toBe(400);

    const missingUserId = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({ event: { id: 'evt-1' } }),
    }) as NextRequest;
    const missingUserIdResponse = await webhookPost(missingUserId);
    expect(missingUserIdResponse.status).toBe(400);
  });

  it('returns 404 when user does not exist', async () => {
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({
        event: { id: 'evt-1', app_user_id: 'user-1', entitlement_ids: ['premium'] },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    expect(response.status).toBe(404);
  });

  it('ignores duplicate webhook events', async () => {
    const { store } = seedUsers({
      'user-1': { usernameLower: 'userone', lastRevenueCatEventId: 'evt-1' },
    });

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({
        event: {
          id: 'evt-1',
          app_user_id: 'user-1',
          entitlement_ids: ['premium'],
          product_id: 'pro',
        },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: 'ignored' });
    expect(getUser(store, 'user-1')).toMatchObject({ lastRevenueCatEventId: 'evt-1' });
  });

  it('updates subscription data from webhook events', async () => {
    const now = Date.now();
    const { store } = seedUsers({
      'user-1': { usernameLower: 'userone', subscriptionStatus: 'unknown' },
    });

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({
        event: {
          id: 'evt-2',
          app_user_id: 'user-1',
          entitlement_ids: ['premium'],
          expiration_at_ms: now + 86400000,
          grace_period_expiration_at_ms: null,
          purchased_at_ms: now - 86400000,
          product_id: 'pro_monthly',
          store: 'APP_STORE',
          environment: 'SANDBOX',
        },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: 'ok' });
    expect(getUser(store, 'user-1')).toMatchObject({
      entitlement: 'premium',
      subscriptionStatus: 'active',
      productId: 'pro_monthly',
      store: 'app_store',
      environment: 'sandbox',
      lastRevenueCatEventId: 'evt-2',
    });
  });

  it('accepts transferred_to ids with a custom auth header', async () => {
    // Covers custom auth headers + transferred_to fallback + new_product_id.
    process.env.REVENUECAT_WEBHOOK_AUTH_HEADER = 'X-Webhook-Token';
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const { store } = seedUsers({
      'user-1': {
        usernameLower: 'userone',
        entitlement: 'premium',
        subscriptionExpiry: future,
        subscriptionStatus: 'unknown',
      },
    });

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-webhook-token': 'secret' },
      body: JSON.stringify({
        event: {
          id: 'evt-3',
          transferred_to: ['user-1'],
          new_product_id: 'pro_plus',
          store: 'APP_STORE',
          environment: 'SANDBOX',
        },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: 'ok' });
    expect(getUser(store, 'user-1')).toMatchObject({
      productId: 'pro_plus',
      store: 'app_store',
      environment: 'sandbox',
      subscriptionStatus: 'active',
    });
  });

  it('keeps unknown status when entitlement is missing and user status is unknown', async () => {
    const { store } = seedUsers({
      'user-1': { usernameLower: 'userone', subscriptionStatus: 'unknown' },
    });

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({
        event: {
          id: 'evt-4',
          app_user_id: 'user-1',
        },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: 'ok' });
    expect(getUser(store, 'user-1')).toMatchObject({
      subscriptionStatus: 'unknown',
      lastRevenueCatEventId: 'evt-4',
    });
  });

  it('rejects webhook events with empty ids', async () => {
    seedUsers({});

    const request = new Request('http://localhost/api/v1/subscription/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'secret' },
      body: JSON.stringify({
        event: { id: '   ', app_user_id: 'user-1' },
      }),
    }) as NextRequest;

    const response = await webhookPost(request);
    expect(response.status).toBe(400);
  });
});
