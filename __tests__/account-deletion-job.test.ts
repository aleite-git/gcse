import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let runAccountDeletionJob: typeof import('@/lib/account-deletion-job').runAccountDeletionJob;

beforeAll(async () => {
  ({ runAccountDeletionJob } = await import('@/lib/account-deletion-job'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('account deletion job', () => {
  it('deletes pending users and related data', async () => {
    const now = new Date();
    const { db } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: { username: 'UserOne', deletionStatus: 'pending', deletionScheduledFor: now },
      },
      [COLLECTIONS.ATTEMPTS]: {
        attempt1: { userLabel: 'UserOne' },
      },
      [COLLECTIONS.QUESTION_STATS]: {
        stat1: { userLabel: 'UserOne' },
      },
      [COLLECTIONS.USER_STREAKS]: {
        streak1: { userLabel: 'UserOne' },
      },
      [COLLECTIONS.STREAK_ACTIVITIES]: {
        activity1: { userLabel: 'UserOne' },
      },
      [COLLECTIONS.USER_PROFILES]: {
        profile1: { labelLower: 'userone' },
      },
      [COLLECTIONS.ACCOUNT_DELETION_REQUESTS]: {
        request1: { userId: 'user1' },
      },
    });
    getDb.mockReturnValue(db);

    const result = await runAccountDeletionJob();
    expect(result.processed).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.errors).toBe(0);

    const userSnapshot = await db.collection(COLLECTIONS.MOBILE_USERS).doc('user1').get();
    expect(userSnapshot.exists).toBe(false);

    const attempts = await db.collection(COLLECTIONS.ATTEMPTS).get();
    expect(attempts.size).toBe(0);
  });

  it('counts errors when username is missing', async () => {
    const now = new Date();
    const { db } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: { deletionStatus: 'pending', deletionScheduledFor: now },
      },
    });
    getDb.mockReturnValue(db);

    const result = await runAccountDeletionJob();
    expect(result.processed).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('records errors when deletion fails', async () => {
    const now = new Date();
    const { db: baseDb } = createFirestoreMock({
      [COLLECTIONS.MOBILE_USERS]: {
        user1: { username: 'UserOne', deletionStatus: 'pending', deletionScheduledFor: now },
      },
    });

    const db = {
      ...baseDb,
      collection: (name: string) => {
        if (name === COLLECTIONS.MOBILE_USERS) {
          return baseDb.collection(name);
        }
        throw new Error('boom');
      },
    };

    getDb.mockReturnValue(db);

    const result = await runAccountDeletionJob();
    expect(result.processed).toBe(1);
    expect(result.deleted).toBe(0);
    expect(result.errors).toBe(1);
  });
});
