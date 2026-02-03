import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';
import { SubscriptionVerificationError } from '@/lib/subscription-verification';

const getSessionFromRequest = jest.fn();
const createFirestoreMobileUserStore = jest.fn();
const verifyAppleSubscription = jest.fn();
const verifyGoogleSubscription = jest.fn();

jest.unstable_mockModule('@/lib/auth', () => ({
  getSessionFromRequest,
}));

jest.unstable_mockModule('@/lib/mobile-user-store', () => ({
  createFirestoreMobileUserStore,
}));

jest.unstable_mockModule('@/lib/subscription-verification', () => ({
  SubscriptionVerificationError,
  verifyAppleSubscription,
  verifyGoogleSubscription,
}));

let verifyPost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: verifyPost } = await import('@/app/api/mobile/subscription/verify/route'));
});

beforeEach(() => {
  getSessionFromRequest.mockReset();
  createFirestoreMobileUserStore.mockReset();
  verifyAppleSubscription.mockReset();
  verifyGoogleSubscription.mockReset();
});

function buildStore(user?: { id: string; usernameLower: string; adminOverride?: boolean | null }) {
  const updateSubscription = jest.fn();
  createFirestoreMobileUserStore.mockReturnValue({
    getByUsername: async (usernameLower: string) => {
      if (!user) return null;
      return usernameLower === user.usernameLower ? user : null;
    },
    updateSubscription,
  });

  return { updateSubscription };
}

describe('mobile subscription verify route', () => {
  it('rejects unauthorized requests', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/mobile/subscription/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', transactionId: '123' }),
    }) as NextRequest;

    const response = await verifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('rejects invalid provider', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
    buildStore({ id: 'user-1', usernameLower: 'userone' });

    const request = new Request('http://localhost/api/mobile/subscription/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'other' }),
    }) as NextRequest;

    const response = await verifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'provider must be apple or google' });
  });

  it('verifies Apple purchases and updates subscription fields', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
    const { updateSubscription } = buildStore({ id: 'user-1', usernameLower: 'userone' });
    const start = new Date('2026-02-01T00:00:00.000Z');
    const expiry = new Date('2027-08-01T00:00:00.000Z');

    verifyAppleSubscription.mockResolvedValue({
      subscriptionStart: start,
      subscriptionExpiry: expiry,
      subscriptionProvider: 'apple',
    });

    const request = new Request('http://localhost/api/mobile/subscription/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', transactionId: 'tx-123' }),
    }) as NextRequest;

    const response = await verifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateSubscription).toHaveBeenCalledWith('user-1', {
      subscriptionStart: start,
      subscriptionExpiry: expiry,
      graceUntil: null,
      subscriptionProvider: 'apple',
    });
    expect(payload).toMatchObject({
      subscriptionProvider: 'apple',
      subscriptionStatus: 'active',
      entitlement: 'premium',
    });
  });

  it('returns errors from verification', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'UserOne', isAdmin: false, iat: 0, exp: 0 });
    buildStore({ id: 'user-1', usernameLower: 'userone' });

    verifyGoogleSubscription.mockRejectedValue(
      new SubscriptionVerificationError('purchaseToken is required', 400)
    );

    const request = new Request('http://localhost/api/mobile/subscription/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'google' }),
    }) as NextRequest;

    const response = await verifyPost(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'purchaseToken is required' });
  });
});
