import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let createUserProfileStore: typeof import('@/lib/user-profile-store').createUserProfileStore;

beforeAll(async () => {
  ({ createUserProfileStore } = await import('@/lib/user-profile-store'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('user profile store', () => {
  it('returns null when label is missing', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const store = createUserProfileStore();
    const result = await store.getByLabel('missing');
    expect(result).toBeNull();
  });

  it('creates and updates profiles', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const store = createUserProfileStore();
    const created = await store.createProfile({
      label: 'User',
      labelLower: 'user',
      activeSubjects: ['Biology'],
      onboardingComplete: false,
      subscriptionStart: null,
      subscriptionExpiry: null,
      graceUntil: null,
      subscriptionProvider: null,
      adminOverride: false,
      createdAt: new Date(),
    });

    expect(created.id).toBeTruthy();
    await store.updateProfile(created.id, { onboardingComplete: true });

    const fetched = await store.getByLabel('user');
    expect(fetched?.onboardingComplete).toBe(true);
  });
});
