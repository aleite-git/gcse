import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { getDb, COLLECTIONS } from './firebase';

export type AccountDeletionRequestStatus = 'pending' | 'verified' | 'expired' | 'cancelled';
export type AccountDeletionRequestType = 'delete' | 'cancel';

export type AccountDeletionRequestRecord = {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  attemptCount: number;
  status: AccountDeletionRequestStatus;
  type: AccountDeletionRequestType;
};

export const ACCOUNT_DELETION_CODE_TTL_MS = 15 * 60 * 1000;
export const ACCOUNT_DELETION_MAX_ATTEMPTS = 5;
export const ACCOUNT_DELETION_RATE_LIMIT = 3;
export const ACCOUNT_DELETION_RATE_WINDOW_MS = 60 * 60 * 1000;
export const ACCOUNT_DELETION_COOL_OFF_DAYS = 15;

export function resolveTimestamp(
  value: Date | { toDate: () => Date } | number | null | undefined
): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }

  return null;
}

export function computeDeletionScheduledFor(start: Date): Date {
  const scheduled = new Date(start);
  scheduled.setDate(scheduled.getDate() + ACCOUNT_DELETION_COOL_OFF_DAYS);
  return scheduled;
}

export function generateVerificationCode(): string {
  const code = randomInt(0, 1000000);
  return String(code).padStart(6, '0');
}

export async function hashVerificationCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

export async function verifyVerificationCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export async function countRecentDeletionRequests(
  userId: string,
  type: AccountDeletionRequestType,
  windowMs: number = ACCOUNT_DELETION_RATE_WINDOW_MS
): Promise<number> {
  const db = getDb();
  const since = new Date(Date.now() - windowMs);
  const snapshot = await db
    .collection(COLLECTIONS.ACCOUNT_DELETION_REQUESTS)
    .where('userId', '==', userId)
    .where('type', '==', type)
    .where('createdAt', '>=', since)
    .get();

  return snapshot.size;
}

export async function createAccountDeletionRequest(params: {
  userId: string;
  email: string;
  type: AccountDeletionRequestType;
  ttlMs?: number;
}): Promise<{ requestId: string; expiresAt: Date; code: string }> {
  const ttlMs = params.ttlMs ?? ACCOUNT_DELETION_CODE_TTL_MS;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(code);

  const docRef = await getDb().collection(COLLECTIONS.ACCOUNT_DELETION_REQUESTS).add({
    userId: params.userId,
    email: params.email,
    codeHash,
    createdAt: now,
    expiresAt,
    attemptCount: 0,
    status: 'pending' as AccountDeletionRequestStatus,
    type: params.type,
  });

  return { requestId: docRef.id, expiresAt, code };
}

export async function getAccountDeletionRequest(
  requestId: string
): Promise<AccountDeletionRequestRecord | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.ACCOUNT_DELETION_REQUESTS)
    .doc(requestId)
    .get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data() as Omit<AccountDeletionRequestRecord, 'id'>;
  return { id: doc.id, ...data };
}

export async function updateAccountDeletionRequest(
  requestId: string,
  update: Partial<Omit<AccountDeletionRequestRecord, 'id' | 'userId' | 'email' | 'type'>>
): Promise<void> {
  await getDb().collection(COLLECTIONS.ACCOUNT_DELETION_REQUESTS).doc(requestId).update(update);
}
