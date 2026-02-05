import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const getSessionFromRequest = jest.fn();
const clearSessionCookie = jest.fn();
const createFirestoreMobileUserStore = jest.fn();
const sendEmail = jest.fn();

const countRecentDeletionRequests = jest.fn();
const createAccountDeletionRequest = jest.fn();
const resolveTimestamp = jest.fn();
const getAccountDeletionRequest = jest.fn();
const updateAccountDeletionRequest = jest.fn();
const verifyVerificationCode = jest.fn();
const computeDeletionScheduledFor = jest.fn();

jest.unstable_mockModule('@/lib/auth', () => ({
  getSessionFromRequest,
  clearSessionCookie,
}));

jest.unstable_mockModule('@/lib/mobile-user-store', () => ({
  createFirestoreMobileUserStore,
}));

jest.unstable_mockModule('@/lib/email', () => ({
  sendEmail,
}));

jest.unstable_mockModule('@/lib/account-deletion', () => ({
  ACCOUNT_DELETION_RATE_LIMIT: 3,
  ACCOUNT_DELETION_RATE_WINDOW_MS: 60 * 60 * 1000,
  ACCOUNT_DELETION_CODE_TTL_MS: 15 * 60 * 1000,
  ACCOUNT_DELETION_MAX_ATTEMPTS: 5,
  countRecentDeletionRequests,
  createAccountDeletionRequest,
  resolveTimestamp,
  getAccountDeletionRequest,
  updateAccountDeletionRequest,
  verifyVerificationCode,
  computeDeletionScheduledFor,
}));

let deleteRequestPost: (request: NextRequest) => Promise<Response>;
let deleteConfirmPost: (request: NextRequest) => Promise<Response>;
let cancelRequestPost: (request: NextRequest) => Promise<Response>;
let cancelConfirmPost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: deleteRequestPost } = await import('@/app/api/mobile/account/delete/request/route'));
  ({ POST: deleteConfirmPost } = await import('@/app/api/mobile/account/delete/confirm/route'));
  ({ POST: cancelRequestPost } = await import('@/app/api/mobile/account/delete/cancel/request/route'));
  ({ POST: cancelConfirmPost } = await import('@/app/api/mobile/account/delete/cancel/confirm/route'));
});

beforeEach(() => {
  getSessionFromRequest.mockReset();
  clearSessionCookie.mockReset();
  createFirestoreMobileUserStore.mockReset();
  sendEmail.mockReset();
  countRecentDeletionRequests.mockReset();
  createAccountDeletionRequest.mockReset();
  resolveTimestamp.mockReset();
  getAccountDeletionRequest.mockReset();
  updateAccountDeletionRequest.mockReset();
  verifyVerificationCode.mockReset();
  computeDeletionScheduledFor.mockReset();

  getSessionFromRequest.mockResolvedValue({ label: 'user1', isAdmin: false, iat: 0, exp: 0 });
  resolveTimestamp.mockImplementation((value: unknown) => value as Date);
});

describe('mobile account deletion routes', () => {
  it('requests deletion and sends email', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: null }),
    });
    countRecentDeletionRequests.mockResolvedValue(0);
    createAccountDeletionRequest.mockResolvedValue({ requestId: 'req1', expiresAt: new Date(), code: '123456' });
    resolveTimestamp.mockReturnValue(null);

    const request = new Request('http://localhost/api/mobile/account/delete/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await deleteRequestPost(request);
    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalled();
  });

  it('rejects deletion request when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/mobile/account/delete/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await deleteRequestPost(request);
    expect(response.status).toBe(401);
  });

  it('rejects deletion request for oauth users', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: 'google' }),
    });

    const request = new Request('http://localhost/api/mobile/account/delete/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await deleteRequestPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects deletion request when already scheduled in the future', async () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({
        id: 'user1',
        email: 'user@example.com',
        oauthProvider: null,
        deletionStatus: 'pending',
        deletionScheduledFor: future,
      }),
    });
    resolveTimestamp.mockReturnValue(future);

    const request = new Request('http://localhost/api/mobile/account/delete/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await deleteRequestPost(request);
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.error).toContain('Deletion already scheduled. Due in');
  });

  it('rejects deletion request when rate limit is exceeded', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: null }),
    });
    countRecentDeletionRequests.mockResolvedValue(3);

    const request = new Request('http://localhost/api/mobile/account/delete/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await deleteRequestPost(request);
    expect(response.status).toBe(429);
  });

  it('confirms deletion and schedules removal', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: null }),
      updateDeletion: async () => {},
    });
    getAccountDeletionRequest.mockResolvedValue({
      id: 'req1',
      userId: 'user1',
      type: 'delete',
      status: 'pending',
      attemptCount: 0,
      codeHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
    });
    verifyVerificationCode.mockResolvedValue(true);
    computeDeletionScheduledFor.mockReturnValue(new Date());

    const request = new Request('http://localhost/api/mobile/account/delete/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req1', code: '123456' }),
    }) as NextRequest;
    const response = await deleteConfirmPost(request);
    expect(response.status).toBe(200);
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('rejects deletion confirm without body fields', async () => {
    const request = new Request('http://localhost/api/mobile/account/delete/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;
    const response = await deleteConfirmPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects deletion confirm when code is expired', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: null }),
      updateDeletion: async () => {},
    });
    getAccountDeletionRequest.mockResolvedValue({
      id: 'req1',
      userId: 'user1',
      type: 'delete',
      status: 'pending',
      attemptCount: 0,
      codeHash: 'hash',
      expiresAt: new Date(Date.now() - 1000),
    });
    resolveTimestamp.mockReturnValue(new Date(Date.now() - 1000));

    const request = new Request('http://localhost/api/mobile/account/delete/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req1', code: '123456' }),
    }) as NextRequest;
    const response = await deleteConfirmPost(request);
    expect(response.status).toBe(410);
    expect(updateAccountDeletionRequest).toHaveBeenCalledWith('req1', { status: 'expired' });
  });

  it('rejects deletion confirm after too many attempts', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', email: 'user@example.com', oauthProvider: null }),
      updateDeletion: async () => {},
    });
    getAccountDeletionRequest.mockResolvedValue({
      id: 'req1',
      userId: 'user1',
      type: 'delete',
      status: 'pending',
      attemptCount: 5,
      codeHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
    });
    resolveTimestamp.mockReturnValue(new Date(Date.now() + 10000));

    const request = new Request('http://localhost/api/mobile/account/delete/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req1', code: '123456' }),
    }) as NextRequest;
    const response = await deleteConfirmPost(request);
    expect(response.status).toBe(429);
  });

  it('requests cancellation and sends email', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({
        id: 'user1',
        email: 'user@example.com',
        oauthProvider: null,
        deletionScheduledFor: new Date(Date.now() + 10000),
        deletionStatus: 'pending',
      }),
    });
    resolveTimestamp.mockReturnValue(new Date(Date.now() + 10000));
    countRecentDeletionRequests.mockResolvedValue(0);
    createAccountDeletionRequest.mockResolvedValue({ requestId: 'req2', expiresAt: new Date(), code: '654321' });

    const request = new Request('http://localhost/api/mobile/account/delete/cancel/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await cancelRequestPost(request);
    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalled();
  });

  it('rejects cancellation request when no pending deletion exists', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({
        id: 'user1',
        email: 'user@example.com',
        oauthProvider: null,
        deletionScheduledFor: null,
        deletionStatus: 'none',
      }),
    });
    resolveTimestamp.mockReturnValue(null);

    const request = new Request('http://localhost/api/mobile/account/delete/cancel/request', {
      method: 'POST',
    }) as NextRequest;
    const response = await cancelRequestPost(request);
    expect(response.status).toBe(404);
  });

  it('confirms cancellation and updates user', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', oauthProvider: null, deletionScheduledFor: new Date(), deletionStatus: 'pending' }),
      updateDeletion: async () => {},
    });
    getAccountDeletionRequest.mockResolvedValue({
      id: 'req2',
      userId: 'user1',
      type: 'cancel',
      status: 'pending',
      attemptCount: 0,
      codeHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
    });
    verifyVerificationCode.mockResolvedValue(true);

    const request = new Request('http://localhost/api/mobile/account/delete/cancel/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req2', code: '654321' }),
    }) as NextRequest;
    const response = await cancelConfirmPost(request);
    expect(response.status).toBe(200);
  });

  it('rejects cancellation confirm when code is invalid', async () => {
    createFirestoreMobileUserStore.mockReturnValue({
      getByUsername: async () => ({ id: 'user1', oauthProvider: null, deletionScheduledFor: new Date(), deletionStatus: 'pending' }),
      updateDeletion: async () => {},
    });
    getAccountDeletionRequest.mockResolvedValue({
      id: 'req2',
      userId: 'user1',
      type: 'cancel',
      status: 'pending',
      attemptCount: 4,
      codeHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
    });
    resolveTimestamp.mockReturnValue(new Date(Date.now() + 10000));
    verifyVerificationCode.mockResolvedValue(false);

    const request = new Request('http://localhost/api/mobile/account/delete/cancel/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'req2', code: 'bad' }),
    }) as NextRequest;
    const response = await cancelConfirmPost(request);
    expect(response.status).toBe(429);
  });
});
