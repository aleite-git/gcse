import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const getTransactionInfo = jest.fn();

jest.unstable_mockModule('@apple/app-store-server-library', () => ({
  AppStoreServerAPIClient: class {
    constructor() {}
    async getTransactionInfo() {
      return getTransactionInfo();
    }
  },
  Environment: { PRODUCTION: 'production', SANDBOX: 'sandbox' },
  ReceiptUtility: class {
    extractTransactionIdFromAppReceipt(receipt: string) {
      return receipt === 'receipt' ? 'tx-from-receipt' : null;
    }
  },
}));

const getClient = jest.fn();
const getAccessToken = jest.fn();

jest.unstable_mockModule('google-auth-library', () => ({
  GoogleAuth: class {
    constructor() {}
    async getClient() {
      return { getAccessToken };
    }
  },
}));

let verifyAppleSubscription: typeof import('@/lib/subscription-verification').verifyAppleSubscription;
let verifyGoogleSubscription: typeof import('@/lib/subscription-verification').verifyGoogleSubscription;

beforeAll(async () => {
  ({ verifyAppleSubscription, verifyGoogleSubscription } = await import('@/lib/subscription-verification'));
});

beforeEach(() => {
  getTransactionInfo.mockReset();
  getAccessToken.mockReset();
  process.env.APPLE_IAP_ISSUER_ID = 'issuer';
  process.env.APPLE_IAP_KEY_ID = 'key';
  process.env.APPLE_IAP_BUNDLE_ID = 'bundle';
  process.env.APPLE_IAP_PRIVATE_KEY = 'private';
  process.env.APPLE_IAP_ENV = 'sandbox';
  process.env.GOOGLE_PLAY_PACKAGE_NAME = '';
});

function makeSignedTransactionInfo(purchaseDate: number) {
  const payload = Buffer.from(JSON.stringify({ purchaseDate })).toString('base64url');
  return `header.${payload}.sig`;
}

describe('subscription verification', () => {
  it('verifies Apple subscription using transactionId', async () => {
    getTransactionInfo.mockResolvedValue({
      signedTransactionInfo: makeSignedTransactionInfo(Date.parse('2026-01-01T00:00:00Z')),
    });

    const result = await verifyAppleSubscription({ transactionId: 'tx-1' });
    expect(result.subscriptionProvider).toBe('apple');
    expect(result.subscriptionStart).toBeInstanceOf(Date);
    expect(result.subscriptionExpiry).toBeInstanceOf(Date);
  });

  it('verifies Apple subscription using app receipt', async () => {
    getTransactionInfo.mockResolvedValue({
      signedTransactionInfo: makeSignedTransactionInfo(Date.parse('2026-02-01T00:00:00Z')),
    });

    const result = await verifyAppleSubscription({ appReceipt: 'receipt' });
    expect(result.subscriptionProvider).toBe('apple');
  });

  it('verifies Google subscription when active', async () => {
    getAccessToken.mockResolvedValue({ token: 'token' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
        startTime: '2026-01-01T00:00:00Z',
      }),
    }) as unknown as typeof fetch;

    const result = await verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.test.app' });
    expect(result.subscriptionProvider).toBe('google');
  });

  it('throws when Apple environment is invalid', async () => {
    process.env.APPLE_IAP_ENV = 'invalid';

    await expect(verifyAppleSubscription({ transactionId: 'tx' })).rejects.toMatchObject({
      message: 'APPLE_IAP_ENV must be sandbox or production',
      status: 500,
    });
  });

  it('requires Apple configuration', async () => {
    delete process.env.APPLE_IAP_ISSUER_ID;

    await expect(verifyAppleSubscription({ transactionId: 'tx' })).rejects.toMatchObject({
      message: 'APPLE_IAP_ISSUER_ID is not configured',
      status: 500,
    });
  });

  it('requires Apple transaction data', async () => {
    await expect(verifyAppleSubscription({})).rejects.toMatchObject({
      message: 'transactionId or appReceipt is required',
      status: 400,
    });
  });

  it('fails when Apple signed transaction info is missing', async () => {
    getTransactionInfo.mockResolvedValue({});

    await expect(verifyAppleSubscription({ transactionId: 'tx' })).rejects.toMatchObject({
      message: 'Missing signed transaction info from Apple',
      status: 500,
    });
  });

  it('fails when Apple signed transaction info is invalid', async () => {
    getTransactionInfo.mockResolvedValue({ signedTransactionInfo: 'not-jws' });

    await expect(verifyAppleSubscription({ transactionId: 'tx' })).rejects.toMatchObject({
      message: 'Invalid signedTransactionInfo',
      status: 500,
    });
  });

  it('fails when Apple purchaseDate cannot be resolved', async () => {
    const payload = Buffer.from(JSON.stringify({ purchaseDate: 'not-a-date' })).toString('base64url');
    getTransactionInfo.mockResolvedValue({ signedTransactionInfo: `header.${payload}.sig` });

    await expect(verifyAppleSubscription({ transactionId: 'tx' })).rejects.toMatchObject({
      message: 'Unable to resolve purchaseDate',
      status: 500,
    });
  });

  it('requires Google purchaseToken and packageName', async () => {
    await expect(verifyGoogleSubscription({})).rejects.toMatchObject({
      message: 'purchaseToken is required',
      status: 400,
    });

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt' })
    ).rejects.toMatchObject({
      message: 'packageName is required',
      status: 500,
    });
  });

  it('rejects mismatched configured package names', async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = 'com.configured';

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.other' })
    ).rejects.toMatchObject({
      message: 'packageName does not match configuration',
      status: 400,
    });
  });

  it('fails when Google access token cannot be obtained', async () => {
    getAccessToken.mockResolvedValue({ token: '' });

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.test.app' })
    ).rejects.toMatchObject({
      message: 'Unable to obtain Google access token',
      status: 500,
    });
  });

  it('fails when Google subscription lookup fails', async () => {
    getAccessToken.mockResolvedValue({ token: 'token' });
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.test.app' })
    ).rejects.toMatchObject({
      message: 'Google subscription lookup failed',
      status: 400,
    });
  });

  it('fails when Google subscription state is missing or inactive', async () => {
    getAccessToken.mockResolvedValue({ token: 'token' });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriptionState: 'SUBSCRIPTION_STATE_UNSPECIFIED',
        startTime: '2026-01-01T00:00:00Z',
      }),
    }) as unknown as typeof fetch;

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.test.app' })
    ).rejects.toMatchObject({
      message: 'Google subscription state unavailable',
      status: 400,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED',
        startTime: '2026-01-01T00:00:00Z',
      }),
    }) as unknown as typeof fetch;

    await expect(
      verifyGoogleSubscription({ purchaseToken: 'pt', packageName: 'com.test.app' })
    ).rejects.toMatchObject({
      message: 'Subscription is not active',
      status: 400,
    });
  });
});
