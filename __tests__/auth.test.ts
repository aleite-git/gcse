import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let hashAccessCode: typeof import('@/lib/auth').hashAccessCode;
let verifyAccessCode: typeof import('@/lib/auth').verifyAccessCode;
let validateAccessCode: typeof import('@/lib/auth').validateAccessCode;
let createSessionToken: typeof import('@/lib/auth').createSessionToken;
let verifySessionToken: typeof import('@/lib/auth').verifySessionToken;
let getSessionFromRequest: typeof import('@/lib/auth').getSessionFromRequest;

beforeAll(async () => {
  ({
    hashAccessCode,
    verifyAccessCode,
    validateAccessCode,
    createSessionToken,
    verifySessionToken,
    getSessionFromRequest,
  } = await import('@/lib/auth'));
});

beforeEach(() => {
  getDb.mockReset();
  process.env.SESSION_SECRET = 'test-secret';
});

describe('auth helpers', () => {
  it('hashes and verifies access codes', async () => {
    const hash = await hashAccessCode('code123');
    expect(await verifyAccessCode('code123', hash)).toBe(true);
    expect(await verifyAccessCode('bad', hash)).toBe(false);
  });

  it('validates access codes against active records', async () => {
    const codeHash = await bcrypt.hash('code123', 12);
    const { db } = createFirestoreMock({
      [COLLECTIONS.ACCESS_CODES]: {
        access1: { codeHash, label: 'Student', isAdmin: false, active: true },
      },
    });
    getDb.mockReturnValue(db);

    const result = await validateAccessCode('code123');
    expect(result?.label).toBe('Student');
  });

  it('returns null when access code is invalid', async () => {
    const codeHash = await bcrypt.hash('code123', 12);
    const { db } = createFirestoreMock({
      [COLLECTIONS.ACCESS_CODES]: {
        access1: { codeHash, label: 'Student', isAdmin: false, active: true },
      },
    });
    getDb.mockReturnValue(db);

    const result = await validateAccessCode('bad');
    expect(result).toBeNull();
  });

  it('creates and verifies session tokens', async () => {
    const token = await createSessionToken('User', true);
    const payload = await verifySessionToken(token);
    expect(payload?.label).toBe('User');
    expect(payload?.isAdmin).toBe(true);
  });

  it('throws when SESSION_SECRET is missing', async () => {
    delete process.env.SESSION_SECRET;
    await expect(createSessionToken('User', false)).rejects.toThrow(
      'SESSION_SECRET environment variable is not set'
    );
  });

  it('returns null for invalid session tokens', async () => {
    const payload = await verifySessionToken('bad.token.value');
    expect(payload).toBeNull();
  });

  it('reads bearer token from request header', async () => {
    const token = await createSessionToken('User', false);
    const request = new Request('http://localhost', {
      headers: { authorization: `Bearer ${token}` },
    });
    const session = await getSessionFromRequest(request);
    expect(session?.label).toBe('User');
  });

  it('reads session from cookie header', async () => {
    const token = await createSessionToken('CookieUser', false);
    const request = new Request('http://localhost', {
      headers: { cookie: `gcse_session=${encodeURIComponent(token)}` },
    });
    const session = await getSessionFromRequest(request);
    expect(session?.label).toBe('CookieUser');
  });

  it('returns null when no cookie header is provided', async () => {
    const request = new Request('http://localhost');
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });

  it('returns null when cookie header has no session token', async () => {
    const request = new Request('http://localhost', {
      headers: { cookie: 'other=value' },
    });
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });
});
