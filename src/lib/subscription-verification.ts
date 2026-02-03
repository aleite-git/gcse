import { addMonths } from 'date-fns';
import {
  AppStoreServerAPIClient,
  Environment,
  ReceiptUtility,
} from '@apple/app-store-server-library';
import { GoogleAuth } from 'google-auth-library';

export type SubscriptionProvider = 'apple' | 'google';

export type VerificationResult = {
  subscriptionStart: Date;
  subscriptionExpiry: Date;
  subscriptionProvider: SubscriptionProvider;
};

export class SubscriptionVerificationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const UNLOCK_MONTHS = 18;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SubscriptionVerificationError(`${name} is not configured`, 500);
  }
  return value;
}

function toDate(value: unknown, label: string): Date {
  if (typeof value === 'number') {
    return new Date(value);
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return new Date(numeric);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  throw new SubscriptionVerificationError(`Unable to resolve ${label}`, 500);
}

function unlockExpiry(purchaseDate: Date): { subscriptionStart: Date; subscriptionExpiry: Date } {
  const subscriptionStart = new Date(purchaseDate);
  const subscriptionExpiry = addMonths(purchaseDate, UNLOCK_MONTHS);
  return { subscriptionStart, subscriptionExpiry };
}

function decodeJwsPayload<T>(token: string): T {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new SubscriptionVerificationError('Invalid signedTransactionInfo', 500);
  }

  const payload = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');

  return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8')) as T;
}

function resolveAppleEnvironment(): Environment {
  const env = (process.env.APPLE_IAP_ENV ?? 'sandbox').toLowerCase();
  if (env === 'production') {
    return Environment.PRODUCTION;
  }
  if (env === 'sandbox') {
    return Environment.SANDBOX;
  }

  throw new SubscriptionVerificationError('APPLE_IAP_ENV must be sandbox or production', 500);
}

export async function verifyAppleSubscription(params: {
  transactionId?: string;
  appReceipt?: string;
}): Promise<VerificationResult> {
  const issuerId = requireEnv('APPLE_IAP_ISSUER_ID');
  const keyId = requireEnv('APPLE_IAP_KEY_ID');
  const bundleId = requireEnv('APPLE_IAP_BUNDLE_ID');
  const privateKey = requireEnv('APPLE_IAP_PRIVATE_KEY');
  const environment = resolveAppleEnvironment();

  let transactionId = params.transactionId?.trim();
  if (!transactionId && params.appReceipt) {
    const receiptUtil = new ReceiptUtility();
    transactionId = receiptUtil.extractTransactionIdFromAppReceipt(params.appReceipt) ?? undefined;
  }

  if (!transactionId) {
    throw new SubscriptionVerificationError('transactionId or appReceipt is required');
  }

  const client = new AppStoreServerAPIClient(privateKey, keyId, issuerId, bundleId, environment);
  const info = await client.getTransactionInfo(transactionId);

  if (!info.signedTransactionInfo) {
    throw new SubscriptionVerificationError('Missing signed transaction info from Apple', 500);
  }

  // We rely on Apple’s API response and decode the signed payload to get the purchase date.
  const transaction = decodeJwsPayload<{ purchaseDate?: number | string }>(
    info.signedTransactionInfo
  );

  const purchaseDate = toDate(transaction.purchaseDate, 'purchaseDate');
  const { subscriptionStart, subscriptionExpiry } = unlockExpiry(purchaseDate);

  return {
    subscriptionStart,
    subscriptionExpiry,
    subscriptionProvider: 'apple',
  };
}

export async function verifyGoogleSubscription(params: {
  purchaseToken?: string;
  packageName?: string;
}): Promise<VerificationResult> {
  const purchaseToken = params.purchaseToken?.trim();
  if (!purchaseToken) {
    throw new SubscriptionVerificationError('purchaseToken is required');
  }

  const configuredPackage = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  const packageName = configuredPackage || params.packageName?.trim();
  if (!packageName) {
    throw new SubscriptionVerificationError('packageName is required', 500);
  }
  if (configuredPackage && params.packageName && params.packageName !== configuredPackage) {
    throw new SubscriptionVerificationError('packageName does not match configuration');
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse?.token;

  if (!accessToken) {
    throw new SubscriptionVerificationError('Unable to obtain Google access token', 500);
  }

  const url =
    'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' +
    `${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(
      purchaseToken
    )}`;

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new SubscriptionVerificationError('Google subscription lookup failed', 400);
  }

  const data = (await response.json()) as {
    subscriptionState?: string;
    startTime?: string;
  };

  if (!data.subscriptionState || data.subscriptionState === 'SUBSCRIPTION_STATE_UNSPECIFIED') {
    throw new SubscriptionVerificationError('Google subscription state unavailable', 400);
  }

  const allowedStates = new Set([
    'SUBSCRIPTION_STATE_ACTIVE',
    'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
  ]);

  if (!allowedStates.has(data.subscriptionState)) {
    throw new SubscriptionVerificationError('Subscription is not active', 400);
  }

  const purchaseDate = toDate(data.startTime, 'startTime');
  const { subscriptionStart, subscriptionExpiry } = unlockExpiry(purchaseDate);

  return {
    subscriptionStart,
    subscriptionExpiry,
    subscriptionProvider: 'google',
  };
}
