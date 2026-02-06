import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { normalizeEmail } from '@/lib/mobile-auth';

type OverrideRequestBody = {
  userId?: string;
  email?: string;
  adminOverride?: boolean;
};

const oauthClient = new OAuth2Client();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'armando.leite@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase());

function reject(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function verifyGoogleIdToken(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return false;
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return false;
    }

    const defaultAudience = new URL(request.url).origin;
    const audience = process.env.ADMIN_OVERRIDE_AUDIENCE ?? defaultAudience;

    const ticket = await oauthClient.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return false;
    }

    return ADMIN_EMAILS.includes(payload.email.toLowerCase());
  } catch (error) {
    console.warn('Admin override token verification failed:', error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const verified = await verifyGoogleIdToken(request);
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: OverrideRequestBody;
    try {
      body = (await request.json()) as OverrideRequestBody;
    } catch {
      return reject('Invalid JSON body');
    }

    const adminOverride = body.adminOverride;
    if (typeof adminOverride !== 'boolean') {
      return reject('adminOverride must be true or false');
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!userId && !email) {
      return reject('Provide either userId or email');
    }

    const store = createFirestoreMobileUserStore();
    const user = userId ? await store.getById(userId) : await store.getByEmail(normalizeEmail(email));

    if (!user) {
      return reject('User not found', 404);
    }

    // Admin override is backend-only; it unlocks all subjects regardless of subscription status.
    await store.updateAdminOverride(user.id, adminOverride);

    return NextResponse.json({
      userId: user.id,
      adminOverride,
    });
  } catch (error) {
    console.error('Subscription override error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating subscription override' },
      { status: 500 }
    );
  }
}
