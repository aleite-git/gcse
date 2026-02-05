import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let createFirestoreMobileUserStore: typeof import('@/lib/mobile-user-store').createFirestoreMobileUserStore;

beforeAll(async () => {
  ({ createFirestoreMobileUserStore } = await import('@/lib/mobile-user-store'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('mobile user store', () => {
  it('gets users by email and username and updates profile', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: {
          emailLower: 'user@example.com',
          usernameLower: 'userone',
          revenueCatAppUserId: 'rc-user-1',
          activeSubjects: [],
          onboardingComplete: false,
        },
      },
    });
    getDb.mockReturnValue(db);

    const store = createFirestoreMobileUserStore();
    const byEmail = await store.getByEmail('user@example.com');
    const byUsername = await store.getByUsername('userone');
    const byRevenueCat = await store.getByRevenueCatAppUserId('rc-user-1');
    expect(byEmail?.id).toBe('user1');
    expect(byUsername?.id).toBe('user1');
    expect(byRevenueCat?.id).toBe('user1');

    await store.updateProfile('user1', { onboardingComplete: true });
    const updated = await store.getById('user1');
    expect(updated?.onboardingComplete).toBe(true);
  });

  it('returns null for missing users and supports oauth lookup', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: {
          emailLower: 'user@example.com',
          usernameLower: 'userone',
          oauthProvider: 'google',
          oauthSubject: 'google-sub',
        },
      },
    });
    getDb.mockReturnValue(db);

    const store = createFirestoreMobileUserStore();
    expect(await store.getById('missing')).toBeNull();
    expect(await store.getByEmail('missing@example.com')).toBeNull();

    const oauthUser = await store.getByOAuth('google', 'google-sub');
    expect(oauthUser?.id).toBe('user1');
  });

  it('updates username, oauth, subscription, admin override, and deletion fields', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: { emailLower: 'user@example.com', usernameLower: 'userone' },
      },
    });
    getDb.mockReturnValue(db);

    const store = createFirestoreMobileUserStore();
    const now = new Date();

    await store.updateUsername('user1', {
      username: 'NewUser',
      usernameLower: 'newuser',
      usernameChangedAt: now,
    });
    await store.updateOAuth('user1', { oauthProvider: 'apple', oauthSubject: 'apple-sub' });
    await store.updateSubscription('user1', {
      subscriptionStart: now,
      subscriptionExpiry: now,
      graceUntil: null,
      subscriptionProvider: 'apple',
      entitlement: 'premium',
      subscriptionStatus: 'active',
      productId: 'pro',
      store: 'app_store',
      environment: 'production',
      revenueCatAppUserId: 'rc-user-1',
      lastRevenueCatEventId: 'evt-1',
    });
    await store.updateAdminOverride('user1', true);
    await store.updateDeletion('user1', { deletionStatus: 'pending', deletionRequestedAt: now });

    const updated = await store.getById('user1');
    expect(updated?.usernameLower).toBe('newuser');
    expect(updated?.oauthProvider).toBe('apple');
    expect(updated?.subscriptionProvider).toBe('apple');
    expect(updated?.entitlement).toBe('premium');
    expect(updated?.subscriptionStatus).toBe('active');
    expect(updated?.productId).toBe('pro');
    expect(updated?.store).toBe('app_store');
    expect(updated?.environment).toBe('production');
    expect(updated?.revenueCatAppUserId).toBe('rc-user-1');
    expect(updated?.lastRevenueCatEventId).toBe('evt-1');
    expect(updated?.adminOverride).toBe(true);
    expect(updated?.deletionStatus).toBe('pending');
  });
});
