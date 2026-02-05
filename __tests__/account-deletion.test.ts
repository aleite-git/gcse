import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let resolveTimestamp: typeof import('@/lib/account-deletion').resolveTimestamp;
let computeDeletionScheduledFor: typeof import('@/lib/account-deletion').computeDeletionScheduledFor;
let createAccountDeletionRequest: typeof import('@/lib/account-deletion').createAccountDeletionRequest;
let getAccountDeletionRequest: typeof import('@/lib/account-deletion').getAccountDeletionRequest;
let updateAccountDeletionRequest: typeof import('@/lib/account-deletion').updateAccountDeletionRequest;
let countRecentDeletionRequests: typeof import('@/lib/account-deletion').countRecentDeletionRequests;
let hashVerificationCode: typeof import('@/lib/account-deletion').hashVerificationCode;
let verifyVerificationCode: typeof import('@/lib/account-deletion').verifyVerificationCode;
let ACCOUNT_DELETION_COOL_OFF_DAYS: typeof import('@/lib/account-deletion').ACCOUNT_DELETION_COOL_OFF_DAYS;

beforeAll(async () => {
  ({
    resolveTimestamp,
    computeDeletionScheduledFor,
    createAccountDeletionRequest,
    getAccountDeletionRequest,
    updateAccountDeletionRequest,
    countRecentDeletionRequests,
    hashVerificationCode,
    verifyVerificationCode,
    ACCOUNT_DELETION_COOL_OFF_DAYS,
  } = await import('@/lib/account-deletion'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('account deletion helpers', () => {
  it('resolves timestamps from Date, number, and toDate()', () => {
    const now = new Date();
    expect(resolveTimestamp(now)?.getTime()).toBe(now.getTime());

    const numberValue = now.getTime();
    expect(resolveTimestamp(numberValue)?.getTime()).toBe(numberValue);

    const toDateValue = { toDate: () => now };
    expect(resolveTimestamp(toDateValue)?.getTime()).toBe(now.getTime());

    expect(resolveTimestamp(null)).toBeNull();
    expect(resolveTimestamp({})).toBeNull();
  });

  it('computes scheduled deletion date based on cool-off days', () => {
    const start = new Date('2026-02-01T00:00:00Z');
    const scheduled = computeDeletionScheduledFor(start);
    const diffDays = Math.round((scheduled.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(ACCOUNT_DELETION_COOL_OFF_DAYS);
  });

  it('creates and updates a deletion request', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const created = await createAccountDeletionRequest({
      userId: 'user-1',
      email: 'user@example.com',
      type: 'delete',
      ttlMs: 1000,
    });

    const stored = await getAccountDeletionRequest(created.requestId);
    expect(stored?.userId).toBe('user-1');
    expect(stored?.status).toBe('pending');

    await updateAccountDeletionRequest(created.requestId, { status: 'verified' });
    const updated = await getAccountDeletionRequest(created.requestId);
    expect(updated?.status).toBe('verified');
  });

  it('returns null when deletion request does not exist', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const result = await getAccountDeletionRequest('missing');
    expect(result).toBeNull();
  });

  it('counts recent deletion requests', async () => {
    const now = new Date();
    const { db } = createFirestoreMock({
      [COLLECTIONS.ACCOUNT_DELETION_REQUESTS]: {
        r1: { userId: 'user-1', type: 'delete', createdAt: new Date(now.getTime() - 1000) },
        r2: { userId: 'user-1', type: 'delete', createdAt: new Date(now.getTime() - 2000) },
        r3: { userId: 'user-1', type: 'cancel', createdAt: new Date(now.getTime() - 1000) },
      },
    });
    getDb.mockReturnValue(db);

    const count = await countRecentDeletionRequests('user-1', 'delete', 5000);
    expect(count).toBe(2);
  });

  it('verifies a deletion code hash', async () => {
    const hash = await hashVerificationCode('123456');
    await expect(verifyVerificationCode('123456', hash)).resolves.toBe(true);
    await expect(verifyVerificationCode('000000', hash)).resolves.toBe(false);
  });
});
