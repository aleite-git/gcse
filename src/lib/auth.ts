import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { getDb, COLLECTIONS } from './firebase';
import { AccessCode, SessionPayload } from '@/types';

const SESSION_COOKIE_NAME = 'gcse_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Hash an access code for storage
 */
export async function hashAccessCode(code: string): Promise<string> {
  return bcrypt.hash(code, 12);
}

/**
 * Verify an access code against a hash
 */
export async function verifyAccessCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

/**
 * Validate access code and return the access code document if valid
 */
export async function validateAccessCode(code: string): Promise<AccessCode | null> {
  const db = getDb();
  const accessCodesRef = db.collection(COLLECTIONS.ACCESS_CODES);
  const snapshot = await accessCodesRef.where('active', '==', true).get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const isValid = await verifyAccessCode(code, data.codeHash);
    if (isValid) {
      return {
        id: doc.id,
        codeHash: data.codeHash,
        label: data.label,
        isAdmin: data.isAdmin,
        active: data.active,
      };
    }
  }

  return null;
}

/**
 * Create a session token
 */
export async function createSessionToken(label: string, isAdmin: boolean): Promise<string> {
  const payload: Omit<SessionPayload, 'iat' | 'exp'> = {
    label,
    isAdmin,
  };

  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecretKey());
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });
}

/**
 * Clear the session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the current session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Get session from a request (for API routes)
 */
export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      return verifySessionToken(token);
    }
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

/**
 * Parse cookie header string into an object
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const [name, value] = pair.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Require admin authentication - throws if not admin
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (!session.isAdmin) {
    throw new Error('Admin access required');
  }
  return session;
}
