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

beforeAll(async () => {
  ({
    createSessionToken,
    setSessionCookie,
    clearSessionCookie,
    getSession,
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
});
