import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const getSessionFromRequest = jest.fn();
const createFirestoreMobileUserStore = jest.fn();
const createUserProfileStore = jest.fn();

jest.unstable_mockModule('@/lib/auth', () => ({
  getSessionFromRequest,
}));

jest.unstable_mockModule('@/lib/mobile-user-store', () => ({
  createFirestoreMobileUserStore,
}));

jest.unstable_mockModule('@/lib/user-profile-store', () => ({
  createUserProfileStore,
}));

let meGet: (request: NextRequest) => Promise<Response>;
let mePatch: (request: NextRequest) => Promise<Response>;
let subjectsPut: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ GET: meGet, PATCH: mePatch } = await import('@/app/api/v1/me/route'));
  ({ PUT: subjectsPut } = await import('@/app/api/v1/me/subjects/route'));
});

beforeEach(() => {
  getSessionFromRequest.mockReset();
  createFirestoreMobileUserStore.mockReset();
  createUserProfileStore.mockReset();
});

function makeMobileStore(overrides: Partial<{
  getByUsername: jest.Mock;
  updateProfile: jest.Mock;
}> = {}) {
  return {
    getByUsername: overrides.getByUsername ?? jest.fn().mockResolvedValue(null),
    updateProfile: overrides.updateProfile ?? jest.fn().mockResolvedValue(undefined),
  };
}

function makeProfileStore(overrides: Partial<{
  getByLabel: jest.Mock;
  createProfile: jest.Mock;
  updateProfile: jest.Mock;
}> = {}) {
  return {
    getByLabel: overrides.getByLabel ?? jest.fn().mockResolvedValue(null),
    createProfile: overrides.createProfile ?? jest.fn().mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'new-profile-1',
      ...data,
    })),
    updateProfile: overrides.updateProfile ?? jest.fn().mockResolvedValue(undefined),
  };
}

function makeFreeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'TestUser',
    usernameLower: 'testuser',
    activeSubjects: ['Biology'],
    onboardingComplete: true,
    subscriptionStart: null,
    subscriptionExpiry: null,
    graceUntil: null,
    subscriptionProvider: null,
    entitlement: null,
    subscriptionStatus: null,
    productId: null,
    store: null,
    environment: null,
    revenueCatAppUserId: null,
    lastRevenueCatEventId: null,
    adminOverride: false,
    ...overrides,
  };
}

function makePremiumUser(overrides: Record<string, unknown> = {}) {
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return makeFreeUser({
    entitlement: 'premium',
    subscriptionExpiry: future,
    subscriptionStatus: 'active',
    subscriptionProvider: 'apple',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// GET /api/v1/me
// ---------------------------------------------------------------------------
describe('GET /api/v1/me', () => {
  it('returns 401 when there is no session', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'GET',
    }) as NextRequest;

    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns profile for an existing mobile user', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });
    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'GET',
    }) as NextRequest;

    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe('user-1');
    expect(payload.activeSubjects).toEqual(['Biology']);
    expect(payload.onboardingComplete).toBe(true);
    expect(payload.entitlement).toBe('free');
  });

  it('returns profile for an existing profile-store user when mobile user not found', async () => {
    const user = makeFreeUser({ id: 'profile-1', label: 'testuser', labelLower: 'testuser' });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore();
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const profileStore = makeProfileStore({
      getByLabel: jest.fn().mockResolvedValue(user),
    });
    createUserProfileStore.mockReturnValue(profileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'GET',
    }) as NextRequest;

    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe('profile-1');
  });

  it('creates a new profile when no user exists', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'NewUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore();
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const profileStore = makeProfileStore();
    createUserProfileStore.mockReturnValue(profileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'GET',
    }) as NextRequest;

    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.id).toBe('new-profile-1');
    expect(payload.onboardingComplete).toBe(true);
    expect(payload.activeSubjects).toEqual(['Biology', 'Chemistry', 'Computer Science']);
    expect(profileStore.createProfile).toHaveBeenCalledTimes(1);
  });

  it('returns premium entitlement for a premium user', async () => {
    const user = makePremiumUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });
    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'GET',
    }) as NextRequest;

    const response = await meGet(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.entitlement).toBe('premium');
    expect(payload.subscriptionStatus).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/me
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/me', () => {
  it('returns 401 when there is no session', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('updates onboardingComplete on a mobile user', async () => {
    const user = makeFreeUser({ onboardingComplete: false, activeSubjects: ['Biology'] });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.onboardingComplete).toBe(true);
    expect(mobileStore.updateProfile).toHaveBeenCalledWith('user-1', {
      activeSubjects: ['Biology'],
      onboardingComplete: true,
    });
  });

  it('updates activeSubjects for a free user with a single subject', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Chemistry'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Chemistry']);
  });

  it('returns 403 when a free user selects multiple subjects', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: 'Premium required to select multiple subjects' });
  });

  it('allows a premium user to select multiple subjects', async () => {
    const user = makePremiumUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

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

  it('returns 400 when activeSubjects is not an array', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: 'Biology' }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must be an array' });
  });

  it('returns 400 when activeSubjects contains an invalid subject', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Maths'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('invalid subject');
  });

  it('returns 400 when onboardingComplete is true but activeSubjects is empty and not provided', async () => {
    const user = makeFreeUser({ activeSubjects: [], onboardingComplete: false });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

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

  it('updates a profile-store user when not found in mobile store', async () => {
    const user = makeFreeUser({ id: 'profile-1', label: 'testuser', labelLower: 'testuser' });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore();
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const profileUpdateFn = jest.fn().mockResolvedValue(undefined);
    const profileStore = makeProfileStore({
      getByLabel: jest.fn().mockResolvedValue(user),
      updateProfile: profileUpdateFn,
    });
    createUserProfileStore.mockReturnValue(profileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Chemistry'] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Chemistry']);
    expect(profileUpdateFn).toHaveBeenCalledWith('profile-1', {
      activeSubjects: ['Chemistry'],
      onboardingComplete: true,
    });
  });

  it('returns 500 on unexpected errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });
    createFirestoreMobileUserStore.mockImplementation(() => {
      throw new Error('db down');
    });

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ onboardingComplete: true }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred while updating profile' });
    consoleSpy.mockRestore();
  });

  it('allows empty activeSubjects when onboarding is not complete', async () => {
    const user = makeFreeUser({ onboardingComplete: false, activeSubjects: [] });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: [] }),
    }) as NextRequest;

    const response = await mePatch(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual([]);
    expect(payload.onboardingComplete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/me/subjects
// ---------------------------------------------------------------------------
describe('PUT /api/v1/me/subjects', () => {
  it('returns 401 when there is no session', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: 'Unauthorized' });
  });

  it('returns 404 when user is not found', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'Ghost', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore();
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const profileStore = makeProfileStore();
    createUserProfileStore.mockReturnValue(profileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toMatchObject({ error: 'User not found' });
  });

  it('updates subjects for a mobile user', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Chemistry'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Chemistry']);
    expect(payload.onboardingComplete).toBe(true);
    expect(mobileStore.updateProfile).toHaveBeenCalledWith('user-1', {
      activeSubjects: ['Chemistry'],
      onboardingComplete: true,
    });
  });

  it('updates subjects for a profile-store user', async () => {
    const user = makeFreeUser({ id: 'profile-1', label: 'testuser', labelLower: 'testuser' });
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore();
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const profileUpdateFn = jest.fn().mockResolvedValue(undefined);
    const profileStore = makeProfileStore({
      getByLabel: jest.fn().mockResolvedValue(user),
      updateProfile: profileUpdateFn,
    });
    createUserProfileStore.mockReturnValue(profileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Biology']);
    expect(profileUpdateFn).toHaveBeenCalledWith('profile-1', {
      activeSubjects: ['Biology'],
      onboardingComplete: true,
    });
  });

  it('returns 400 when activeSubjects is not an array', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: 'Biology' }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({ error: 'activeSubjects must be an array' });
  });

  it('returns 400 when activeSubjects is empty', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

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

  it('returns 400 when activeSubjects contains an invalid subject', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Physics'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('invalid subject');
  });

  it('returns 403 when a free user selects multiple subjects', async () => {
    const user = makeFreeUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: 'Premium required to select multiple subjects' });
  });

  it('allows a premium user to select multiple subjects', async () => {
    const user = makePremiumUser();
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });

    const mobileStore = makeMobileStore({
      getByUsername: jest.fn().mockResolvedValue(user),
    });
    createFirestoreMobileUserStore.mockReturnValue(mobileStore);

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology', 'Chemistry', 'Computer Science'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.activeSubjects).toEqual(['Biology', 'Chemistry', 'Computer Science']);
  });

  it('returns 500 on unexpected errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getSessionFromRequest.mockResolvedValue({ label: 'TestUser', isAdmin: false, iat: 0, exp: 0 });
    createFirestoreMobileUserStore.mockImplementation(() => {
      throw new Error('db down');
    });

    const request = new Request('http://localhost/api/v1/me/subjects', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeSubjects: ['Biology'] }),
    }) as NextRequest;

    const response = await subjectsPut(request);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toMatchObject({ error: 'An error occurred while updating subjects' });
    consoleSpy.mockRestore();
  });
});
