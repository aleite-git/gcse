import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const initializeApp = jest.fn();
const getApps = jest.fn();
const cert = jest.fn();
const getFirestore = jest.fn();

jest.unstable_mockModule('firebase-admin/app', () => ({
  initializeApp,
  getApps,
  cert,
}));

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore,
}));

beforeEach(() => {
  initializeApp.mockReset();
  getApps.mockReset();
  cert.mockReset();
  getFirestore.mockReset();
  delete process.env.K_SERVICE;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  getApps.mockReturnValue([]);
  getFirestore.mockReturnValue({});
  jest.resetModules();
});

describe('firebase getDb', () => {
  it('reuses an existing app when already initialized', async () => {
    const existingApp = { name: 'existing-app' };
    getApps.mockReturnValue([existingApp]);

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();

    expect(db).toEqual({});
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalledWith(existingApp);
  });

  it('uses emulator when FIRESTORE_EMULATOR_HOST is set', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_PROJECT_ID = 'demo';

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();
    expect(db).toEqual({});
    expect(initializeApp).toHaveBeenCalled();
  });

  it('uses K_SERVICE when running on GCP', async () => {
    process.env.K_SERVICE = 'service';
    process.env.GOOGLE_CLOUD_PROJECT = 'proj';

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();
    expect(db).toEqual({});
    expect(initializeApp).toHaveBeenCalled();
  });

  it('uses GOOGLE_APPLICATION_CREDENTIALS when present', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/key.json';
    process.env.FIREBASE_PROJECT_ID = 'demo';

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();

    expect(db).toEqual({});
    expect(cert).toHaveBeenCalledWith('/path/to/key.json');
    expect(initializeApp).toHaveBeenCalled();
  });

  it('uses inline FIREBASE_PRIVATE_KEY credentials', async () => {
    process.env.FIREBASE_PRIVATE_KEY = 'line1\\nline2';
    process.env.FIREBASE_CLIENT_EMAIL = 'service@example.com';
    process.env.FIREBASE_PROJECT_ID = 'demo';

    const { getDb } = await import('@/lib/firebase');
    const db = getDb();

    expect(db).toEqual({});
    expect(cert).toHaveBeenCalled();
    expect(initializeApp).toHaveBeenCalled();
  });

  it('throws when no credentials are configured', async () => {
    getApps.mockReturnValue([]);
    const { getDb } = await import('@/lib/firebase');
    expect(() => getDb()).toThrow('Firebase credentials not configured');
  });
});
