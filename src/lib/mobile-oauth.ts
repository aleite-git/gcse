import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { MobileAuthError, normalizeEmail, OAuthProfile } from './mobile-auth';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const APPLE_ISSUER = 'https://appleid.apple.com';
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function ensureString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseEmailVerified(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return false;
}

async function verifyToken(
  idToken: string,
  jwks: ReturnType<typeof createRemoteJWKSet>,
  options: { issuer: string | string[]; audience: string }
): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(idToken, jwks, options);
    return payload;
  } catch {
    throw new MobileAuthError('Invalid OAuth token', 401);
  }
}

function buildProfile(provider: 'google' | 'apple', payload: JWTPayload): OAuthProfile {
  const subject = ensureString(payload.sub);
  if (!subject) {
    throw new MobileAuthError('Invalid OAuth token', 401);
  }

  const email = ensureString(payload.email);
  const emailLower = email ? normalizeEmail(email) : '';

  return {
    provider,
    subject,
    email,
    emailLower,
    emailVerified: parseEmailVerified(payload.email_verified),
  };
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string
): Promise<OAuthProfile> {
  const payload = await verifyToken(idToken, googleJwks, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  });

  return buildProfile('google', payload);
}

export async function verifyAppleIdToken(
  idToken: string,
  clientId: string
): Promise<OAuthProfile> {
  const payload = await verifyToken(idToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: clientId,
  });

  return buildProfile('apple', payload);
}
