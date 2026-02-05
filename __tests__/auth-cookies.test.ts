import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const cookieStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
};

jest.unstable_mockModule('next/headers', () => ({
  cookies: async () => cookieStore,
}));

let createSessionToken: typeof import('@/lib/auth').createSessionToken;
let setSessionCookie: typeof import('@/lib/auth').setSessionCookie;
let clearSessionCookie: typeof import('@/lib/auth').clearSessionCookie;
let getSession: typeof import('@/lib/auth').getSession;
let requireAuth: typeof import('@/lib/auth').requireAuth;
let requireAdmin: typeof import('@/lib/auth').requireAdmin;

beforeAll(async () => {
  ({
    createSessionToken,
    setSessionCookie,
    clearSessionCookie,
    getSession,
    requireAuth,
    requireAdmin,
  } = await import('@/lib/auth'));
});

beforeEach(() => {
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  process.env.SESSION_SECRET = 'test-secret';
});

describe('auth cookie helpers', () => {
  it('sets and clears session cookie', async () => {
    const token = await createSessionToken('User', false);
    await setSessionCookie(token);
    expect(cookieStore.set).toHaveBeenCalled();

    await clearSessionCookie();
    expect(cookieStore.delete).toHaveBeenCalled();
  });

  it('reads session from cookie store', async () => {
    const token = await createSessionToken('CookieUser', false);
    cookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.label).toBe('CookieUser');
  });

  it('returns null when no cookie is present', async () => {
    cookieStore.get.mockReturnValue(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('requireAuth throws when unauthenticated', async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(requireAuth()).rejects.toThrow('Unauthorized');
  });

  it('requireAuth returns session when authenticated', async () => {
    const token = await createSessionToken('User', false);
    cookieStore.get.mockReturnValue({ value: token });
    const session = await requireAuth();
    expect(session.label).toBe('User');
  });

  it('requireAdmin throws for non-admin users', async () => {
    const token = await createSessionToken('User', false);
    cookieStore.get.mockReturnValue({ value: token });
    await expect(requireAdmin()).rejects.toThrow('Admin access required');
  });

  it('requireAdmin returns session for admins', async () => {
    const token = await createSessionToken('Admin', true);
    cookieStore.get.mockReturnValue({ value: token });
    const session = await requireAdmin();
    expect(session.isAdmin).toBe(true);
  });
});
